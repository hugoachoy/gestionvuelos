
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, isValid, differenceInMinutes, startOfDay, parse, isBefore, differenceInDays, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CompletedEngineFlight, Pilot, Aircraft, ScheduleEntry, PilotCategory, EngineFlightPurpose, FlightTypeId } from '@/types';
import { ENGINE_FLIGHT_PURPOSE_OPTIONS, FLIGHT_TYPES, FLIGHT_PURPOSE_DISPLAY_MAP } from '@/types';
import { usePilotsStore, useAircraftStore, useCompletedEngineFlightsStore, useScheduleStore, usePilotCategoriesStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Check, ChevronsUpDown, AlertTriangle, Loader2, Save, Clock, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

const normalizeCategoryName = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

const INSTRUCTOR_AVION_KEYWORDS = ["instructor", "avion"];

const uiPurposeValues = ENGINE_FLIGHT_PURPOSE_OPTIONS.map(opt => opt.value) as [string, ...string[]];

const engineFlightSchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  instructor_id: z.string().optional().nullable(),
  engine_aircraft_id: z.string().min(1, "Seleccione una aeronave."),
  flight_purpose: z.enum(uiPurposeValues, { required_error: "El propósito del vuelo es obligatorio." }),
  departure_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de salida inválido (HH:MM)."),
  arrival_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de llegada inválido (HH:MM)."),
  route_from_to: z.string().optional().nullable(),
  landings_count: z.coerce.number().int().min(1, "Debe registrar al menos un aterrizaje."),
  tows_count: z.coerce.number().int().min(0, "Debe ser 0 o más.").optional().nullable(),
  oil_added_liters: z.coerce.number().int("La cantidad de aceite debe ser un número entero.").min(0, "Debe ser 0 o más.").optional().nullable(),
  fuel_added_liters: z.coerce.number().min(0, "Debe ser 0 o más.").optional().nullable(),
  notes: z.string().optional().nullable(),
  schedule_entry_id: z.string().optional().nullable(),
}).refine(data => {
  if (data.departure_time && data.arrival_time) {
    const [depH, depM] = data.departure_time.split(':').map(Number);
    const [arrH, arrM] = data.arrival_time.split(':').map(Number);
    return (arrH * 60 + arrM) > (depH * 60 + depM);
  }
  return true;
}, {
  message: "La hora de llegada debe ser posterior a la hora de salida.",
  path: ["arrival_time"],
}).refine(data => data.pilot_id !== data.instructor_id, {
  message: "El piloto no puede ser su propio instructor.",
  path: ["instructor_id"],
}).refine(data => {
  if (data.flight_purpose === 'Instrucción (Recibida)') {
    return !!data.instructor_id;
  }
  return true;
}, {
  message: "Se requiere un instructor para 'Instrucción (Recibida)'.",
  path: ["instructor_id"],
});

type EngineFlightFormData = z.infer<typeof engineFlightSchema>;

const normalizeText = (text?: string | null): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const ENGINE_FLIGHT_REQUIRED_CATEGORY_KEYWORDS = ["piloto de avion", "remolcador", "instructor avion"];

const mapScheduleTypeToEnginePurpose = (scheduleTypeId: FlightTypeId): string | undefined => {
    switch (scheduleTypeId) {
        case 'instruction_taken': return 'Instrucción (Recibida)';
        case 'instruction_given': return 'Instrucción (Impartida)';
        case 'towage': return 'Remolque planeador';
        case 'trip': return 'viaje';
        case 'local': return 'local';
        default:
            return undefined;
    }
};

interface EngineFlightFormClientProps {
  flightIdToLoad?: string;
}

const isTimeOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    if (!isValid(start1) || !isValid(end1) || !isValid(start2) || !isValid(end2)) {
        return false;
    }
    return start1 < end2 && start2 < end1;
};

export function EngineFlightFormClient({ flightIdToLoad }: EngineFlightFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { pilots, loading: pilotsLoading, fetchPilots, getPilotName } = usePilotsStore();
  const aircraftStore = useAircraftStore();
  const { aircraft, loading: aircraftLoading, fetchAircraft } = aircraftStore;
  const { categories, loading: categoriesLoading, fetchCategories: fetchPilotCategories } = usePilotCategoriesStore();
  const { scheduleEntries, loading: scheduleLoading, fetchScheduleEntries } = useScheduleStore();
  const { addCompletedEngineFlight, updateCompletedEngineFlight, loading: submittingAddUpdate, fetchCompletedEngineFlights } = useCompletedEngineFlightsStore();

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [instructorSearchTerm, setInstructorSearchTerm] = useState('');
  const [instructorPopoverOpen, setInstructorPopoverOpen] = useState(false);
  const [medicalWarning, setMedicalWarning] = useState<string | null>(null);
  const [instructorMedicalWarning, setInstructorMedicalWarning] = useState<string | null>(null);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [calculatedDuration, setCalculatedDuration] = useState<string | null>(null);
  const [aircraftWarning, setAircraftWarning] = useState<string | null>(null);
  
  const [isFetchingFlightDetails, setIsFetchingFlightDetails] = useState(false);
  const [flightFetchError, setFlightFetchError] = useState<string | null>(null);
  const [initialFlightData, setInitialFlightData] = useState<CompletedEngineFlight | null>(null);
  
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

  const isEditMode = !!flightIdToLoad;
  const picOrStudentLabel = 'Piloto';

  const form = useForm<EngineFlightFormData>({
    resolver: zodResolver(engineFlightSchema),
    defaultValues: {
      date: new Date(),
      pilot_id: '',
      instructor_id: null,
      engine_aircraft_id: '',
      flight_purpose: undefined,
      departure_time: '',
      arrival_time: '',
      route_from_to: null,
      landings_count: 1,
      tows_count: 0,
      oil_added_liters: null,
      fuel_added_liters: null,
      notes: null,
      schedule_entry_id: null,
    },
  });

  const scheduleEntryIdParam = searchParams.get('schedule_id');

  useEffect(() => {
    if (user && pilots && pilots.length > 0) {
      const userPilot = pilots.find(p => p.auth_user_id === user.id);
      setCurrentUserLinkedPilotId(userPilot?.id || null);
    }
  }, [user, pilots]);

  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchPilotCategories();
    if (scheduleEntryIdParam && !isEditMode) {
        const dateParam = searchParams.get('date');
        if (dateParam) fetchScheduleEntries(dateParam);
    }
  }, [fetchPilots, fetchAircraft, fetchPilotCategories, scheduleEntryIdParam, fetchScheduleEntries, isEditMode]);

  useEffect(() => {
    const loadFlightDetails = async () => {
      if (isEditMode && flightIdToLoad && typeof flightIdToLoad === 'string' && flightIdToLoad.trim() !== '' && user) {
        setIsFetchingFlightDetails(true);
        setFlightFetchError(null);
        setInitialFlightData(null);
        try {
          const { data, error } = await supabase
            .from('completed_engine_flights')
            .select('*')
            .eq('id', flightIdToLoad)
            .single();

          if (error) {
            if (error.code === 'PGRST116' || !data) {
                setFlightFetchError("No se pudo encontrar el vuelo solicitado o no tienes permiso para editarlo.");
            } else {
                setFlightFetchError(error.message || "Error al cargar los detalles del vuelo.");
            }
          } else if (data) {
            if (data.auth_user_id === user.id || user.is_admin) {
                setInitialFlightData(data);
                
                let uiFlightPurpose: string = data.flight_purpose;
                 if (data.flight_purpose === 'instrucción') {
                    if (data.instructor_id && data.auth_user_id && pilots.length > 0) {
                        const instructorPilot = pilots.find(p => p.id === data.instructor_id);
                        if (instructorPilot && instructorPilot.auth_user_id === data.auth_user_id) {
                           uiFlightPurpose = 'Instrucción (Impartida)';
                        } else {
                           uiFlightPurpose = 'Instrucción (Recibida)';
                        }
                    } else {
                        uiFlightPurpose = 'Instrucción (Recibida)';
                    }
                }

                form.reset({
                    ...data,
                    date: data.date ? parseISO(data.date) : new Date(),
                    instructor_id: data.instructor_id || null,
                    route_from_to: data.route_from_to || null,
                    landings_count: data.landings_count ?? 1,
                    tows_count: data.tows_count ?? 0,
                    oil_added_liters: data.oil_added_liters || null,
                    fuel_added_liters: data.fuel_added_liters || null,
                    notes: data.notes || null,
                    schedule_entry_id: data.schedule_entry_id || null,
                    departure_time: data.departure_time ? data.departure_time.substring(0,5) : '',
                    arrival_time: data.arrival_time ? data.arrival_time.substring(0,5) : '',
                    flight_purpose: uiFlightPurpose as EngineFlightFormData['flight_purpose'],
                });
            } else {
                setFlightFetchError("No tienes permiso para editar este vuelo.");
            }
          } else {
            setFlightFetchError("No se recibieron datos del vuelo.");
          }
        } catch (e: any) {
          setFlightFetchError(e.message || "Un error inesperado ocurrió al cargar el vuelo.");
        } finally {
          setIsFetchingFlightDetails(false);
        }
      }
    };

    if (user && pilots.length > 0 && categories.length > 0) {
        if (isEditMode) {
            loadFlightDetails();
        } else if (scheduleEntryIdParam && scheduleEntries.length > 0 && aircraft.length > 0) {
          const entry = scheduleEntries.find(e => e.id === scheduleEntryIdParam);
          if (entry) {
            const prefilledFlightPurpose = mapScheduleTypeToEnginePurpose(entry.flight_type_id);

            form.reset({
              date: entry.date ? parseISO(entry.date) : new Date(),
              pilot_id: entry.pilot_id || '',
              engine_aircraft_id: entry.aircraft_id || '',
              departure_time: entry.start_time ? entry.start_time.substring(0,5) : '',
              arrival_time: '',
              schedule_entry_id: entry.id,
              instructor_id: null,
              flight_purpose: prefilledFlightPurpose as EngineFlightFormData['flight_purpose'],
              route_from_to: null,
              landings_count: 1,
              tows_count: 0,
              oil_added_liters: null,
              fuel_added_liters: null,
              notes: null,
            });
          }
        } else if (!scheduleEntryIdParam && aircraft.length > 0 && user && pilots.length > 0) {
            const userPilotId = pilots.find(p => p.auth_user_id === user.id)?.id;
            form.reset({
                date: new Date(),
                pilot_id: userPilotId || '',
                instructor_id: null,
                engine_aircraft_id: '',
                flight_purpose: undefined,
                departure_time: '',
                arrival_time: '',
                route_from_to: null,
                landings_count: 1,
                tows_count: 0,
                oil_added_liters: null,
                fuel_added_liters: null,
                notes: null,
                schedule_entry_id: null,
            });
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, flightIdToLoad, user, scheduleEntryIdParam, scheduleEntries.length, pilots.length, aircraft.length, categories.length, currentUserLinkedPilotId]);


  const watchedPilotId = form.watch("pilot_id");
  const watchedInstructorId = form.watch("instructor_id");
  const watchedDate = form.watch("date");
  const watchedDepartureTime = form.watch('departure_time');
  const watchedArrivalTime = form.watch('arrival_time');
  const watchedFlightPurpose = form.watch('flight_purpose');
  const watchedEngineAircraftId = form.watch("engine_aircraft_id");

  useEffect(() => {
    setAircraftWarning(null);
    if (watchedEngineAircraftId && watchedDate && isValid(watchedDate)) {
      const selectedAC = aircraft.find(ac => ac.id === watchedEngineAircraftId);
      if (selectedAC) {
        const flightDateStart = startOfDay(watchedDate);
        const isInsuranceExpired = selectedAC.insurance_expiry_date && isValid(parseISO(selectedAC.insurance_expiry_date)) && isBefore(parseISO(selectedAC.insurance_expiry_date), flightDateStart);
        if (selectedAC.is_out_of_service) {
          setAircraftWarning(`La aeronave "${selectedAC.name}" está fuera de servicio.`);
        } else if (isInsuranceExpired) {
          setAircraftWarning(`El seguro de la aeronave "${selectedAC.name}" estaba vencido en la fecha del vuelo.`);
        }
      }
    }
  }, [watchedEngineAircraftId, aircraft, watchedDate]);
  
  useEffect(() => {
    if (watchedFlightPurpose === 'Instrucción (Impartida)' && form.getValues("instructor_id")) {
        form.setValue("instructor_id", null, { shouldValidate: true });
        setInstructorSearchTerm('');
    }
  }, [watchedFlightPurpose, form]);

  useEffect(() => {
    if (watchedFlightPurpose === 'Remolque planeador') {
      form.setValue('tows_count', 1, { shouldValidate: true });
    } else {
      if (form.getValues('tows_count') !== 0) {
          form.setValue('tows_count', 0, { shouldValidate: true });
      }
    }
  }, [watchedFlightPurpose, form]);

  useEffect(() => {
    if (watchedDepartureTime && watchedArrivalTime && watchedDate && /^\d{2}:\d{2}/.test(watchedDepartureTime.substring(0,5)) && /^\d{2}:\d{2}/.test(watchedArrivalTime.substring(0,5))) {
      const depTimeCleaned = watchedDepartureTime.substring(0,5);
      const arrTimeCleaned = watchedArrivalTime.substring(0,5);

      const [depH, depM] = depTimeCleaned.split(':').map(Number);
      const [arrH, arrM] = arrTimeCleaned.split(':').map(Number);

      if (arrH * 60 + arrM <= depH * 60 + depM) {
        setCalculatedDuration(null);
        form.setError("arrival_time", { type: "manual", message: "La hora de llegada debe ser posterior a la hora de salida." });
        return;
      } else {
        form.clearErrors("arrival_time");
      }

      const departureDateTime = new Date(watchedDate);
      departureDateTime.setHours(depH, depM, 0, 0);

      const arrivalDateTime = new Date(watchedDate);
      arrivalDateTime.setHours(arrH, arrM, 0, 0);

      if (isValid(departureDateTime) && isValid(arrivalDateTime)) {
        const durationMinutes = differenceInMinutes(arrivalDateTime, departureDateTime);
        if (durationMinutes > 0) {
          const decimalHours = durationMinutes / 60;
          const roundedDecimalHours = Math.ceil(decimalHours * 10) / 10;
          setCalculatedDuration(`${roundedDecimalHours.toFixed(1)} hs`);
        } else {
          setCalculatedDuration(null);
        }
      } else {
        setCalculatedDuration(null);
      }
    } else {
      setCalculatedDuration(null);
       if (form.formState.errors.arrival_time?.message === "La hora de llegada debe ser posterior a la hora de salida.") {
            form.clearErrors("arrival_time");
        }
    }
  }, [watchedDepartureTime, watchedArrivalTime, watchedDate, form]);

  const checkPilotValidity = useCallback(() => {
    const checkMedical = (pilotId: string | null | undefined, date: Date | undefined, role: string): string | null => {
        if (!pilotId || !date || pilots.length === 0) return null;
        const pilot = pilots.find(p => p.id === pilotId);
        if (!pilot?.medical_expiry) return null;
        const medicalExpiryDate = parseISO(pilot.medical_expiry);
        if (!isValid(medicalExpiryDate)) return null;
        const flightDate = startOfDay(date);
        if (isBefore(medicalExpiryDate, flightDate)) {
            return `¡Psicofísico de ${role} VENCIDO el ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })}!`;
        }
        const daysDiff = differenceInDays(medicalExpiryDate, flightDate);
        if (daysDiff <= 30) {
            return `Psicofísico de ${role} vence pronto: ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })} (${daysDiff} días).`;
        }
        return null;
    }

    setMedicalWarning(checkMedical(watchedPilotId, watchedDate, 'Piloto'));
    setInstructorMedicalWarning(checkMedical(watchedInstructorId, watchedDate, 'Instructor'));
    
    setCategoryWarning(null);
    if (!watchedPilotId || !watchedDate || pilots.length === 0 || categories.length === 0) {
      return;
    }
    const pilot = pilots.find(p => p.id === watchedPilotId);
    if (!pilot) return;

    const pilotCategoryNamesNormalized = pilot.category_ids
      .map(catId => {
        const foundCategory = categories.find(c => c.id === catId);
        return foundCategory ? normalizeText(foundCategory.name) : null;
      })
      .filter(Boolean) as string[];

    const hasRequiredCategory = pilotCategoryNamesNormalized.some(normalizedCatName =>
      ENGINE_FLIGHT_REQUIRED_CATEGORY_KEYWORDS.some(normalizedKeyword => normalizedCatName.includes(normalizedKeyword))
    );

    if (!hasRequiredCategory) {
      setCategoryWarning("El piloto seleccionado no tiene la categoría requerida (Piloto de Avión, Remolcador, o Instructor de Avión) para registrar este vuelo.");
    }

  }, [watchedPilotId, watchedInstructorId, watchedDate, pilots, categories]);

  useEffect(() => {
    checkPilotValidity();
  }, [checkPilotValidity]);


  const enginePilotCategoryIds = useMemo(() => {
    if (categoriesLoading || !categories.length) return [];
    return categories
      .filter(cat => ENGINE_FLIGHT_REQUIRED_CATEGORY_KEYWORDS.some(keyword => normalizeText(cat.name).includes(keyword)))
      .map(cat => cat.id);
  }, [categories, categoriesLoading]);

  const sortedPilotsForEngineFlights = useMemo(() => {
    if (pilotsLoading || !pilots.length || !enginePilotCategoryIds.length) return [];
    let availablePilots = [...pilots];
    
    return availablePilots
      .filter(pilot => pilot.category_ids.some(catId => enginePilotCategoryIds.includes(catId)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotsLoading, enginePilotCategoryIds]);


  const instructorAvionCategoryId = useMemo(() => {
    if (categoriesLoading) return undefined;
    const category = categories.find(cat => {
      const normalized = normalizeCategoryName(cat.name);
      return INSTRUCTOR_AVION_KEYWORDS.every(kw => normalized.includes(kw));
    });
    return category?.id;
  }, [categories, categoriesLoading]);

  const sortedInstructors = useMemo(() => {
    if (!instructorAvionCategoryId || pilotsLoading || !pilots.length) return [];
    return pilots.filter(pilot =>
      pilot.category_ids.includes(instructorAvionCategoryId) &&
      pilot.id !== watchedPilotId
    ).sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotsLoading, instructorAvionCategoryId, watchedPilotId]);


  const filteredEngineAircraft = useMemo(() => {
    return aircraft.filter(ac => ac.type === 'Tow Plane' || ac.type === 'Avión')
                   .sort((a,b) => a.name.localeCompare(b.name));
  }, [aircraft]);

  const isAnyPilotInvalidForFlight = useMemo(() => {
    const isPicExpired = medicalWarning?.toUpperCase().includes("VENCIDO");
    const isInstructorExpired = instructorMedicalWarning?.toUpperCase().includes("VENCIDO");
    return !!(isPicExpired || isInstructorExpired);
  }, [medicalWarning, instructorMedicalWarning]);

  const onSubmit = async (formData: EngineFlightFormData) => {
    setIsSubmittingForm(true);
    try {
        if (!user) {
            toast({ title: "Error", description: "Debes estar autenticado para esta acción.", variant: "destructive" });
            setIsSubmittingForm(false);
            return;
        }

        if (aircraftWarning) {
            toast({ title: "Error de Aeronave", description: aircraftWarning, variant: "destructive" });
            setIsSubmittingForm(false);
            return;
        }

        if (isAnyPilotInvalidForFlight) {
            let errorMessages: string[] = [];
            if (medicalWarning?.toUpperCase().includes("VENCIDO")) errorMessages.push(medicalWarning);
            if (instructorMedicalWarning?.toUpperCase().includes("VENCIDO")) errorMessages.push(instructorMedicalWarning);

            toast({
                title: "Error de Psicofísico Vencido",
                description: `No se puede registrar el vuelo. Revise: ${errorMessages.join(' ')}`,
                variant: "destructive",
                duration: 7000,
            });
            setIsSubmittingForm(false);
            return;
        }

        if (categoryWarning && !user.is_admin) {
            toast({
                title: "Error de Categoría",
                description: categoryWarning,
                variant: "destructive",
                duration: 7000,
            });
            setIsSubmittingForm(false);
            return;
        }
        
        const selectedAircraft = aircraftStore.aircraft.find(ac => ac.id === formData.engine_aircraft_id);
        if (!selectedAircraft || (selectedAircraft.type !== 'Tow Plane' && selectedAircraft.type !== 'Avión')) {
          toast({
            title: "Error de Aeronave",
            description: "La aeronave seleccionada no es un avión de motor o remolcador. Solo estos tipos pueden ser registrados en este libro.",
            variant: "destructive",
            duration: 7000,
          });
          setIsSubmittingForm(false);
          return;
        }

        const flightDate = formData.date;
        const newFlightStart = parse(formData.departure_time, 'HH:mm', new Date(flightDate));
        const newFlightEnd = parse(formData.arrival_time, 'HH:mm', new Date(flightDate));


        const { data: allFlightsOnDate, error: fetchError } = await supabase
            .from('completed_engine_flights')
            .select('*')
            .eq('date', format(flightDate, 'yyyy-MM-dd'));

        if (fetchError) {
            toast({ title: "Error", description: "No se pudo verificar el conflicto de horarios. Intente nuevamente.", variant: "destructive" });
            setIsSubmittingForm(false);
            return;
        }

        const flightsToCheckForConflict = allFlightsOnDate?.filter(f => isEditMode ? f.id !== flightIdToLoad : true) || [];
        
        const overlappingFlights = flightsToCheckForConflict.filter(existingFlight => {
            if (existingFlight.engine_aircraft_id !== formData.engine_aircraft_id) return false;
            const existingStart = parse(existingFlight.departure_time, 'HH:mm:ss', new Date(flightDate));
            const existingEnd = parse(existingFlight.arrival_time, 'HH:mm:ss', new Date(flightDate));
            return isTimeOverlap(newFlightStart, newFlightEnd, existingStart, existingEnd);
        });

        if (overlappingFlights.length > 0) {
            const currentIsInstructor = formData.flight_purpose === 'Instrucción (Impartida)';
            const currentIsStudent = formData.flight_purpose === 'Instrucción (Recibida)';
            
            // Check if the current flight is part of a valid instruction pair with the conflicting one
            const isInstructionPair = overlappingFlights.length === 1 &&
              ( (currentIsStudent && overlappingFlights[0].pilot_id === formData.instructor_id) || // Current is student, conflict is their instructor
                (currentIsInstructor && overlappingFlights[0].instructor_id === formData.pilot_id) ); // Current is instructor, conflict is their student
                
            if (isInstructionPair) {
                const existingFlight = overlappingFlights[0];
                const hasFuelOrOilInNewFlight = (formData.fuel_added_liters ?? 0) > 0 || (formData.oil_added_liters ?? 0) > 0;
                const existingFlightHasFuelOrOil = (existingFlight.fuel_added_liters ?? 0) > 0 || (existingFlight.oil_added_liters ?? 0) > 0;
                
                if (hasFuelOrOilInNewFlight && existingFlightHasFuelOrOil) {
                    toast({
                        title: "Carga Duplicada Detectada",
                        description: "El combustible/aceite ya fue registrado en el vuelo de instrucción por la otra persona. Ingrese la carga en un solo registro.",
                        variant: "destructive",
                        duration: 8000,
                    });
                    setIsSubmittingForm(false);
                    return;
                }
            } else {
                const conflictingPilotName = getPilotName(overlappingFlights[0].pilot_id);
                toast({
                    title: "Conflicto de Horario",
                    description: `La aeronave ya tiene un vuelo registrado que se superpone con este horario (Vuelo de ${conflictingPilotName}).`,
                    variant: "destructive",
                    duration: 8000
                });
                setIsSubmittingForm(false);
                return;
            }
        }
        
        let dbFlightPurpose: EngineFlightPurpose;
        let finalInstructorIdForSave: string | null | undefined = null;
        
        if (formData.flight_purpose === 'Instrucción (Recibida)') {
            dbFlightPurpose = 'instrucción';
            finalInstructorIdForSave = formData.instructor_id;
        } else if (formData.flight_purpose === 'Instrucción (Impartida)') {
            dbFlightPurpose = 'instrucción';
            finalInstructorIdForSave = null;
        } else {
            dbFlightPurpose = formData.flight_purpose as EngineFlightPurpose;
            finalInstructorIdForSave = null;
        }

        const depTimeCleaned = formData.departure_time.substring(0,5);
        const arrTimeCleaned = formData.arrival_time.substring(0,5);

        const departureDateTime = parse(depTimeCleaned, 'HH:mm', formData.date);
        const arrivalDateTime = parse(arrTimeCleaned, 'HH:mm', formData.date);
        const durationMinutes = differenceInMinutes(arrivalDateTime, departureDateTime);

        let flightDurationDecimal = 0;
        if (durationMinutes > 0) {
            const decimalHours = durationMinutes / 60;
            flightDurationDecimal = parseFloat((Math.ceil(decimalHours * 10) / 10).toFixed(1));
        }

        let billableMins: number | null = null;
        if (dbFlightPurpose !== 'Remolque planeador' && durationMinutes > 0) {
          billableMins = durationMinutes;
        }
        
        const submissionData = {
            ...formData,
            instructor_id: finalInstructorIdForSave,
            flight_purpose: dbFlightPurpose,
            date: format(formData.date, 'yyyy-MM-dd'),
            departure_time: depTimeCleaned,
            arrival_time: arrTimeCleaned,
            flight_duration_decimal: flightDurationDecimal,
            billable_minutes: billableMins,
            schedule_entry_id: formData.schedule_entry_id || null,
            route_from_to: formData.route_from_to || null,
            tows_count: formData.tows_count ?? 0,
            oil_added_liters: formData.oil_added_liters || null,
            fuel_added_liters: formData.fuel_added_liters || null,
            notes: formData.notes || null,
        };

        let result;
        if (isEditMode && flightIdToLoad && typeof flightIdToLoad === 'string' && flightIdToLoad.trim() !== '') {
            if (!initialFlightData) {
                console.error("Attempted to update flight but initial flight data is missing.", { flightIdToLoad });
                toast({
                    title: "Error de Edición",
                    description: "No se pudieron cargar los datos originales del vuelo. Por favor, intente recargar la página o contacte soporte.",
                    variant: "destructive",
                });
                setIsSubmittingForm(false);
                return;
            }
            const { id, created_at, logbook_type, auth_user_id, ...updatePayload } = { ...initialFlightData, ...submissionData };
            result = await updateCompletedEngineFlight(flightIdToLoad, updatePayload);
        } else if (!isEditMode) {
             if (!flightIdToLoad || flightIdToLoad.trim() === '') {
                result = await addCompletedEngineFlight({
                    ...submissionData,
                    logbook_type: 'engine',
                    auth_user_id: user.id,
                });
            } else {
                console.error("Form submission in add mode but flightIdToLoad is present and non-empty:", flightIdToLoad);
                toast({ title: "Error de Formulario", description: "Conflicto en modo de formulario. Intente recargar.", variant: "destructive" });
                setIsSubmittingForm(false);
                return;
            }
        } else {
            console.error("Form submission in edit mode but flightIdToLoad is invalid:", flightIdToLoad);
            toast({ title: "Error de Edición", description: "ID de vuelo para edición no es válido.", variant: "destructive" });
            setIsSubmittingForm(false);
            return;
        }

        if (result) {
            toast({ title: `Vuelo a Motor ${isEditMode ? 'Actualizado' : 'Registrado'}`, description: `El vuelo ha sido ${isEditMode ? 'actualizado' : 'guardado'} exitosamente.` });
            await fetchCompletedEngineFlights(); 
            await fetchAircraft(); 
            router.push('/aircraft'); 
        } else {
            toast({ title: `Error al ${isEditMode ? 'Actualizar' : 'Registrar'}`, description: "No se pudo guardar el vuelo. Intenta de nuevo.", variant: "destructive" });
        }
    } catch (error) {
        console.error(`Error during form submission (${isEditMode ? 'edit' : 'add'}):`, error);
        toast({ title: "Error Inesperado", description: "Ocurrió un error inesperado al procesar el formulario.", variant: "destructive" });
    } finally {
        setIsSubmittingForm(false);
    }
  };

  const isLoadingInitialData = pilotsLoading || aircraftLoading || categoriesLoading || scheduleLoading || (isEditMode && isFetchingFlightDetails);
  const isLoading = authLoading || isLoadingInitialData || submittingAddUpdate || isSubmittingForm;

  const isSubmitDisabled =
    isLoading ||
    isAnyPilotInvalidForFlight ||
    (categoryWarning != null && !user?.is_admin) ||
    !!aircraftWarning;


  if (authLoading) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditMode ? 'Cargando Editor de Vuelo...' : 'Cargando Formulario...'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" /><Skeleton className="h-10 w-full" />
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6">
          <Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-32" />
        </CardFooter>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditMode ? 'Editar Vuelo a Motor' : 'Detalles del Vuelo a Motor'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Autenticación Requerida</AlertTitle>
            <AlertDescription>
              Debes iniciar sesión para {isEditMode ? 'editar' : 'registrar'} un nuevo vuelo.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button asChild>
            <Link href="/login">Iniciar Sesión</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (isEditMode && isFetchingFlightDetails) {
     return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader><CardTitle>Cargando Detalles del Vuelo...</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-6">
                <Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-32" />
            </CardFooter>
        </Card>
    );
  }

  if (isEditMode && flightFetchError) {
    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader><CardTitle>Error al Cargar Vuelo</CardTitle></CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{flightFetchError}</AlertDescription>
                </Alert>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button asChild variant="outline"><Link href="/logbook/engine/list">Volver al listado</Link></Button>
            </CardFooter>
        </Card>
    );
  }

  if (isLoadingInitialData && !isEditMode) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader><CardTitle>Cargando Formulario...</CardTitle></CardHeader>
        <CardContent className="space-y-4">
             <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
             <Skeleton className="h-20 w-full" />
        </CardContent>
         <CardFooter className="flex justify-end gap-2 pt-6">
            <Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-32" />
        </CardFooter>
      </Card>
    );
  }


  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditMode ? 'Editar Vuelo a Motor' : 'Detalles del Vuelo a Motor'}</CardTitle>
         {isEditMode && initialFlightData?.auth_user_id !== user?.id && user?.is_admin && (
            <Alert variant="default" className="mt-2 border-blue-500 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">Modo Administrador</AlertTitle>
                <AlertDescription className="text-blue-700/90">
                    Estás editando el vuelo de {getPilotName(initialFlightData?.pilot_id)}.
                </AlertDescription>
            </Alert>
        )}
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {medicalWarning && (
              <Alert variant={medicalWarning.toUpperCase().includes("VENCIDO") ? "destructive" : "default"} className={!medicalWarning.toUpperCase().includes("VENCIDO") ? "border-yellow-500" : ""}>
                <AlertTriangle className={cn("h-4 w-4", !medicalWarning.toUpperCase().includes("VENCIDO") && "text-yellow-600")} />
                <AlertTitle>{medicalWarning.toUpperCase().includes("VENCIDO") ? "Psicofísico Vencido" : "Advertencia de Psicofísico"}</AlertTitle>
                <AlertDescription>{medicalWarning}</AlertDescription>
              </Alert>
            )}
            {categoryWarning && (
              <Alert variant={user?.is_admin ? "default" : "destructive"} className={user?.is_admin ? "border-blue-500 bg-blue-50" : ""}>
                <AlertTriangle className={cn("h-4 w-4", user?.is_admin && "text-blue-600" )} />
                <AlertTitle className={cn(user?.is_admin && "text-blue-700")}>{user?.is_admin ? "Aviso de Categoría (Admin)" : "Categoría No Válida"}</AlertTitle>
                <AlertDescription className={cn(user?.is_admin && "text-blue-700/90")}>
                    {categoryWarning}
                    {user?.is_admin && " (Como administrador, puedes registrar este vuelo igualmente.)"}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Fecha</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          disabled={isLoading}
                        >
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => { if(date) field.onChange(date); setIsCalendarOpen(false); }}
                        disabled={(date) => date > new Date() || isLoading}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

             <FormField
              control={form.control}
              name="flight_purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Propósito del Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar propósito" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ENGINE_FLIGHT_PURPOSE_OPTIONS.map((purpose) => (
                        <SelectItem key={purpose.value} value={purpose.value}>
                          {purpose.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pilot_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">{picOrStudentLabel}</FormLabel>
                   <Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={isLoading}
                        >
                          {field.value ? getPilotName(field.value) : `Seleccionar ${picOrStudentLabel.toLowerCase()}`}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm} />
                        <CommandList>
                           {(!sortedPilotsForEngineFlights || sortedPilotsForEngineFlights.length === 0) && !pilotsLoading && !categoriesLoading ? (
                            <CommandEmpty>No hay pilotos con categoría para vuelo a motor.</CommandEmpty>
                          ) : (
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                          )}
                          <CommandGroup>
                            {sortedPilotsForEngineFlights?.map((pilot) => (
                              <CommandItem
                                value={`${pilot.last_name}, ${pilot.first_name}`}
                                key={pilot.id}
                                onSelect={() => {
                                  form.setValue("pilot_id", pilot.id, { shouldValidate: true });
                                  setPilotPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")} />
                                {pilot.last_name}, {pilot.first_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {(!sortedPilotsForEngineFlights || sortedPilotsForEngineFlights.length === 0) && !pilotsLoading && !categoriesLoading && <FormDescription className="text-xs text-destructive">No hay pilotos habilitados para vuelos a motor. Verifique las categorías de los pilotos.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedFlightPurpose === 'Instrucción (Recibida)' && (
              <FormField
                  control={form.control}
                  name="instructor_id"
                  render={({ field }) => (
                      <FormItem className="flex flex-col">
                      <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Instructor</FormLabel>
                      <Popover open={instructorPopoverOpen} onOpenChange={setInstructorPopoverOpen}>
                          <PopoverTrigger asChild>
                          <FormControl>
                              <Button
                              variant="outline"
                              role="combobox"
                              className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                              disabled={isLoading || !instructorAvionCategoryId}
                              >
                              {field.value ? getPilotName(field.value) : "Seleccionar instructor"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                          </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                              <CommandInput placeholder="Buscar instructor..." value={instructorSearchTerm} onValueChange={setInstructorSearchTerm}/>
                              <CommandList>
                              {field.value && (
                                  <CommandItem
                                  key="clear-instructor"
                                  value="Limpiar selección"
                                  onSelect={() => {
                                      form.setValue("instructor_id", null, { shouldValidate: true });
                                      setInstructorPopoverOpen(false);
                                      setInstructorSearchTerm('');
                                  }}
                                  className="text-muted-foreground italic"
                                  >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Limpiar selección de instructor
                                  </CommandItem>
                              )}
                              <CommandEmpty>No se encontraron instructores de avión.</CommandEmpty>
                              <CommandGroup>
                                  {sortedInstructors.map((pilot) => (
                                  <CommandItem
                                      value={`${pilot.last_name}, ${pilot.first_name}`}
                                      key={pilot.id}
                                      onSelect={() => {
                                      form.setValue("instructor_id", pilot.id, { shouldValidate: true });
                                      setInstructorPopoverOpen(false);
                                      }}
                                  >
                                      <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")} />
                                      {pilot.last_name}, {pilot.first_name}
                                  </CommandItem>
                                  ))}
                              </CommandGroup>
                              </CommandList>
                          </Command>
                          </PopoverContent>
                      </Popover>
                      {!instructorAvionCategoryId && !categoriesLoading && <FormDescription className="text-xs text-destructive">No se encontró una categoría que contenga "Instructor" y "Avión". Por favor, créela.</FormDescription>}
                      <FormMessage />
                      {instructorMedicalWarning && (
                          <Alert variant={instructorMedicalWarning.toUpperCase().includes("VENCIDO") ? "destructive" : "default"} className="mt-2 text-xs">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{instructorMedicalWarning}</AlertDescription>
                          </Alert>
                      )}
                      </FormItem>
                  )}
              />
            )}

            <FormField
              control={form.control}
              name="engine_aircraft_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Aeronave de Motor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar aeronave de motor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredEngineAircraft.map((ac) => {
                        const flightDateStart = watchedDate ? startOfDay(watchedDate) : startOfDay(new Date());
                        const isInsuranceExpiredOnFlightDate = ac.insurance_expiry_date && isValid(parseISO(ac.insurance_expiry_date)) && isBefore(parseISO(ac.insurance_expiry_date), flightDateStart);
                        const isEffectivelyOutOfService = ac.is_out_of_service || isInsuranceExpiredOnFlightDate;
                        let outOfServiceReason = "";
                        if (ac.is_out_of_service) {
                          outOfServiceReason = "(Fuera de Servicio)";
                        } else if (isInsuranceExpiredOnFlightDate) {
                          outOfServiceReason = "(Seguro Vencido en fecha)";
                        }
                        return (
                          <SelectItem key={ac.id} value={ac.id} disabled={isEffectivelyOutOfService}>
                            {ac.name} ({ac.type}) {isEffectivelyOutOfService && ` ${outOfServiceReason}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {aircraftWarning && (
                <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Aeronave no disponible</AlertTitle>
                    <AlertDescription>{aircraftWarning}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="departure_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Hora de Salida (HH:MM)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="14:30" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Use formato de 24 horas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="arrival_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Hora de Llegada (HH:MM)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="15:00" {...field} disabled={isLoading} />
                    </FormControl>
                     <FormDescription className="text-xs">
                      Use formato de 24 horas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {calculatedDuration && (
              <div className="mt-1 p-3 border rounded-md bg-muted/50 shadow-sm">
                <div className="flex items-center text-sm font-medium text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2 text-primary" />
                  Duración Calculada: <span className="ml-1 text-foreground font-semibold">{calculatedDuration}</span>
                </div>
              </div>
            )}

            <FormField
                control={form.control}
                name="route_from_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Ruta (Desde - Hasta) (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Aeroclub - Chivilcoy - Aeroclub" {...field} value={field.value ?? ""} disabled={isLoading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="landings_count"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Aterrizajes</FormLabel>
                        <FormControl>
                        <Input type="number" min="1" {...field} onChange={e => field.onChange(Number(e.target.value))} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="tows_count"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Remolques Realizados (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" min="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading || watchedFlightPurpose !== 'Remolque planeador'} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="fuel_added_liters"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Nafta Cargada (Lts) (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.1" min="0" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="oil_added_liters"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Aceite Cargado (Lts) (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" min="0" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Anotaciones adicionales sobre el vuelo..." {...field} value={field.value ?? ""}  disabled={isLoading}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-end gap-2 pt-6">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditMode ? 'Guardar Cambios' : 'Guardar Vuelo a Motor'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
