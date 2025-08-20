
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, isValid, differenceInMinutes, startOfDay, parse, isBefore, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CompletedEngineFlight, Pilot, Aircraft, ScheduleEntry, PilotCategory, FlightPurpose, CompletedFlight, CompletedGliderFlight } from '@/types';
import { usePilotsStore, useAircraftStore, useCompletedEngineFlightsStore, useCompletedGliderFlightsStore, useScheduleStore, usePilotCategoriesStore, useFlightPurposesStore } from '@/store/data-hooks';
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
import { CalendarIcon, Check, ChevronsUpDown, AlertTriangle, Loader2, Save, Clock, Info, XCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

const normalizeCategoryName = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

const INSTRUCTOR_AVION_KEYWORDS = ["instructor", "avion"];

const createEngineFlightSchema = () => z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  instructor_id: z.string().optional().nullable(),
  engine_aircraft_id: z.string().min(1, "Seleccione una aeronave."),
  flight_purpose_id: z.string().min(1, "El propósito del vuelo es obligatorio."),
  departure_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de salida inválido (HH:MM)."),
  arrival_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de llegada inválido (HH:MM)."),
  route_from_to: z.string().optional().nullable(),
  landings_count: z.coerce.number().int().min(1, "Debe registrar al menos un aterrizaje."),
  tows_count: z.coerce.number().int().min(0, "Debe ser 0 o más.").optional().nullable(),
  oil_added_liters: z.coerce.number().min(0, "Debe ser 0 o más.").optional().nullable(),
  fuel_added_liters: z.coerce.number().min(0, "Debe ser 0 o más.").optional().nullable(),
  notes: z.string().optional().nullable(),
  schedule_entry_id: z.string().optional().nullable(),
});

type EngineFlightFormData = z.infer<ReturnType<typeof createEngineFlightSchema>>;

const normalizeText = (text?: string | null): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const ENGINE_FLIGHT_REQUIRED_CATEGORY_KEYWORDS = ["piloto de avion", "remolcador", "instructor avion"];

interface EngineFlightFormClientProps {
  flightIdToLoad?: string;
}

export function EngineFlightFormClient({ flightIdToLoad }: EngineFlightFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { pilots, loading: pilotsLoading, fetchPilots, getPilotName } = usePilotsStore();
  const { aircraftWithCalculatedData, loading: aircraftLoading, fetchAircraft, getAircraftName } = useAircraftStore();
  const { categories, loading: categoriesLoading, fetchCategories: fetchPilotCategories } = usePilotCategoriesStore();
  const { purposes, loading: purposesLoading, getPurposeName, fetchFlightPurposes } = useFlightPurposesStore();
  const { scheduleEntries, loading: scheduleLoading, fetchScheduleEntries } = useScheduleStore();
  const { addCompletedEngineFlight, updateCompletedEngineFlight, loading: submittingAddUpdate, completedEngineFlights } = useCompletedEngineFlightsStore();

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
  const [aircraftConflictWarning, setAircraftConflictWarning] = useState<string | null>(null);
  const [pilotConflictWarning, setPilotConflictWarning] = useState<string | null>(null);
  
  const [isFetchingFlightDetails, setIsFetchingFlightDetails] = useState(false);
  const [flightFetchError, setFlightFetchError] = useState<string | null>(null);
  const [initialFlightData, setInitialFlightData] = useState<CompletedEngineFlight | null>(null);
  
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

  const isEditMode = !!flightIdToLoad;
  
  const form = useForm<EngineFlightFormData>({
    resolver: zodResolver(createEngineFlightSchema()),
    defaultValues: {
      date: new Date(),
      pilot_id: '',
      instructor_id: null,
      engine_aircraft_id: '',
      flight_purpose_id: '',
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
  
  const currentFlightPurposeId = form.watch('flight_purpose_id');
  const selectedPurpose = useMemo(() => purposes.find(p => p.id === currentFlightPurposeId), [purposes, currentFlightPurposeId]);
  
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
    fetchFlightPurposes();
    if (scheduleEntryIdParam && !isEditMode) {
        const dateParam = searchParams.get('date');
        if (dateParam) fetchScheduleEntries(dateParam);
    }
  }, [fetchPilots, fetchAircraft, fetchPilotCategories, fetchFlightPurposes, scheduleEntryIdParam, fetchScheduleEntries, isEditMode]);

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
            const isOwner = data.auth_user_id === user.id;
            if (isOwner || user.is_admin) {
                setInitialFlightData(data);
                form.reset({
                    ...data,
                    date: data.date ? parseISO(data.date) : new Date(),
                    pilot_id: data.pilot_id,
                    instructor_id: data.instructor_id || null,
                    route_from_to: data.route_from_to || null,
                    landings_count: data.landings_count ?? 1,
                    tows_count: data.tows_count ?? 0,
                    oil_added_liters: data.oil_added_liters,
                    fuel_added_liters: data.fuel_added_liters,
                    notes: data.notes || null,
                    schedule_entry_id: data.schedule_entry_id || null,
                    departure_time: data.departure_time ? data.departure_time.substring(0,5) : '',
                    arrival_time: data.arrival_time ? data.arrival_time.substring(0,5) : '',
                    flight_purpose_id: data.flight_purpose_id,
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
        } else if (scheduleEntryIdParam && scheduleEntries.length > 0 && aircraftWithCalculatedData.length > 0 && purposes.length > 0) {
          const entry = scheduleEntries.find(e => e.id === scheduleEntryIdParam);
          if (entry) {
            
            const purposeNameMap: Record<string, string | undefined> = {
                'instruction_taken': 'Instrucción (Recibida)',
                'instruction_given': 'Instrucción (Impartida)',
                'local': 'Local',
                'sport': 'Deportivo',
                'towage': 'Remolque planeador',
                'trip': 'Travesía'
            };
            const targetPurposeName = purposeNameMap[entry.flight_type_id as keyof typeof purposeNameMap];
            const correspondingPurpose = purposes.find(p => p.name === targetPurposeName);

            form.reset({
              date: entry.date ? parseISO(entry.date) : new Date(),
              pilot_id: entry.pilot_id || '',
              engine_aircraft_id: entry.aircraft_id || '',
              departure_time: entry.start_time ? entry.start_time.substring(0,5) : '',
              arrival_time: '',
              schedule_entry_id: entry.id,
              instructor_id: null,
              flight_purpose_id: correspondingPurpose?.id || '',
              route_from_to: null,
              landings_count: 1,
              tows_count: 0,
              oil_added_liters: null,
              fuel_added_liters: null,
              notes: null,
            });
          }
        } else if (!scheduleEntryIdParam && aircraftWithCalculatedData.length > 0 && user && pilots.length > 0) {
            const userPilotId = pilots.find(p => p.auth_user_id === user.id)?.id;
            form.reset({
                date: new Date(),
                pilot_id: userPilotId || '',
                instructor_id: null,
                engine_aircraft_id: '',
                flight_purpose_id: '',
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
  }, [isEditMode, flightIdToLoad, user, scheduleEntryIdParam, scheduleEntries.length, pilots.length, aircraftWithCalculatedData.length, categories.length, purposes.length]); 


  const watchedPilotId = form.watch("pilot_id");
  const watchedInstructorId = form.watch("instructor_id");
  const watchedDate = form.watch("date");
  const watchedDepartureTime = form.watch('departure_time');
  const watchedArrivalTime = form.watch('arrival_time');
  const watchedEngineAircraftId = form.watch("engine_aircraft_id");
  
  const isInstructionMode = useMemo(() => selectedPurpose?.name.includes('Instrucción'), [selectedPurpose]);
  const isRemolqueMode = useMemo(() => selectedPurpose?.name.includes('Remolque'), [selectedPurpose]);

  const handleTimeInputBlur = (event: React.FocusEvent<HTMLInputElement>, fieldName: 'departure_time' | 'arrival_time') => {
    let value = event.target.value.replace(/[^0-9]/g, '');
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    if (value.length === 3) {
      value = '0' + value;
    }
    if (value.length === 4) {
      const hours = value.substring(0, 2);
      const minutes = value.substring(2, 4);
      if (parseInt(hours, 10) < 24 && parseInt(minutes, 10) < 60) {
        const formattedTime = `${hours}:${minutes}`;
        form.setValue(fieldName, formattedTime, { shouldValidate: true });
      }
    }
  };

  useEffect(() => {
    setAircraftWarning(null);
    if (watchedEngineAircraftId && watchedDate && isValid(watchedDate)) {
      const selectedAC = aircraftWithCalculatedData.find(ac => ac.id === watchedEngineAircraftId);
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
  }, [watchedEngineAircraftId, aircraftWithCalculatedData, watchedDate]);
  
  useEffect(() => {
    if (!isInstructionMode) {
      if (form.getValues("instructor_id")) {
        form.setValue("instructor_id", null, { shouldValidate: true });
        setInstructorSearchTerm('');
      }
    }
  }, [isInstructionMode, form]);

  useEffect(() => {
    if (isRemolqueMode) {
      form.setValue('tows_count', 1, { shouldValidate: true });
    } else {
      if (form.getValues('tows_count') !== 0) {
          form.setValue('tows_count', 0, { shouldValidate: true });
      }
    }
  }, [isRemolqueMode, form]);

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

  const checkPilotMedical = useCallback((pilotId: string | null | undefined, date: Date | undefined, role: string): string | null => {
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
  }, [pilots]);

  useEffect(() => {
    setMedicalWarning(checkPilotMedical(watchedPilotId, watchedDate, 'Piloto'));
    setInstructorMedicalWarning(checkPilotMedical(watchedInstructorId, watchedDate, 'Instructor'));
    
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

  }, [watchedPilotId, watchedInstructorId, watchedDate, pilots, categories, checkPilotMedical]);

  useEffect(() => {
    const checkConflicts = async () => {
        const { date, departure_time, arrival_time, engine_aircraft_id, pilot_id, instructor_id } = form.getValues();
        const validTimes = date && departure_time && arrival_time && /^\d{2}:\d{2}$/.test(departure_time) && /^\d{2}:\d{2}$/.test(arrival_time) && arrival_time > departure_time;
        
        setAircraftConflictWarning(null);
        setPilotConflictWarning(null);

        if (!validTimes) return;

        if (engine_aircraft_id) {
            const { data: hasAircraftConflict, error: aircraftError } = await supabase.rpc('check_engine_conflict', {
                p_date: format(date, 'yyyy-MM-dd'),
                p_start_time: departure_time,
                p_end_time: arrival_time,
                p_engine_id: engine_aircraft_id,
                p_exclude_flight_id: isEditMode ? flightIdToLoad : null,
            });

            if (aircraftError && Object.keys(aircraftError).length > 0) {
                console.error("Error en validación de conflicto de aeronave:", aircraftError);
                setAircraftConflictWarning("No se pudo validar el horario de la aeronave debido a un error inesperado.");
            } else if (hasAircraftConflict) {
                setAircraftConflictWarning("Conflicto de Horario: Esta aeronave ya tiene un vuelo registrado en este rango horario.");
            }
        }

        const pilotIdsToCheck = [pilot_id, instructor_id].filter(Boolean) as string[];
        const uniquePilotIds = [...new Set(pilotIdsToCheck)];
        
        let pilotConflictFound = false;
        for (const pId of uniquePilotIds) {
            const { data: hasPilotConflict, error: pilotError } = await supabase.rpc('check_pilot_conflict', {
                p_date: format(date, 'yyyy-MM-dd'),
                p_start_time: departure_time,
                p_end_time: arrival_time,
                p_pilot_id: pId,
                p_exclude_flight_id: isEditMode ? flightIdToLoad : null,
                p_exclude_logbook_type: isEditMode ? 'engine' : null,
            });

            if (pilotError && Object.keys(pilotError).length > 0) {
                console.error(`Error en validación de conflicto para piloto ${pId}:`, pilotError);
                setPilotConflictWarning(`No se pudo validar el horario para ${getPilotName(pId)}.`);
                pilotConflictFound = true;
                break;
            }
            if (hasPilotConflict) {
                setPilotConflictWarning(`Conflicto de Horario: ${getPilotName(pId)} ya tiene otro vuelo en este rango horario.`);
                pilotConflictFound = true;
                break;
            }
        }
        if (!pilotConflictFound) {
            setPilotConflictWarning(null);
        }
    };
    checkConflicts();
  }, [watchedDate, watchedDepartureTime, watchedArrivalTime, watchedEngineAircraftId, watchedPilotId, watchedInstructorId, form, isEditMode, flightIdToLoad, getPilotName]);

  const enginePilotCategoryIds = useMemo(() => {
    if (categoriesLoading || !categories.length) return [];
    return categories
      .filter(cat => ENGINE_FLIGHT_REQUIRED_CATEGORY_KEYWORDS.some(keyword => normalizeText(cat.name).includes(keyword)))
      .map(cat => cat.id);
  }, [categories, categoriesLoading]);

  const sortedPilotsForEngineFlights = useMemo(() => {
    if (pilotsLoading || !pilots.length || !enginePilotCategoryIds.length) return [];
    return pilots
      .filter(pilot => pilot.category_ids.some(catId => enginePilotCategoryIds.includes(catId)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotsLoading, enginePilotCategoryIds]);

  const sortedStudents = useMemo(() => {
    if (pilotsLoading || !pilots.length) return [];
    return sortedPilotsForEngineFlights;
  }, [pilotsLoading, sortedPilotsForEngineFlights]);


  const instructorAvionCategoryId = useMemo(() => {
    if (categoriesLoading) return undefined;
    const category = categories.find(cat => {
      const normalized = normalizeCategoryName(cat.name);
      return INSTRUCTOR_AVION_KEYWORDS.every(kw => normalized.includes(kw));
    });
    return category?.id;
  }, [categories, categoriesLoading]);

  const sortedInstructorsForDropdown = useMemo(() => {
      if (!instructorAvionCategoryId) return [];
      return pilots
        .filter(pilot => pilot.category_ids.includes(instructorAvionCategoryId))
        .sort((a,b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, instructorAvionCategoryId]);
  
  const filteredEngineAircraft = useMemo(() => {
    return aircraftWithCalculatedData.filter(ac => ac.type === 'Tow Plane' || ac.type === 'Avión')
                   .sort((a,b) => a.name.localeCompare(b.name));
  }, [aircraftWithCalculatedData]);

  const filteredPurposes = useMemo(() => {
      return purposes.filter(p => p.applies_to.includes('engine'));
  }, [purposes]);

  const isAnyPilotInvalidForFlight = useMemo(() => {
    const isPicExpired = medicalWarning?.toUpperCase().includes("VENCIDO");
    const isInstructorExpired = instructorMedicalWarning?.toUpperCase().includes("VENCIDO");
    return !!(isPicExpired || isInstructorExpired);
  }, [medicalWarning, instructorMedicalWarning]);

  const onSubmit = async (formData: EngineFlightFormData) => {
    setIsSubmittingForm(true);

    if (!user) {
        toast({ title: "Error", description: "Debes estar autenticado para esta acción.", variant: "destructive" });
        setIsSubmittingForm(false);
        return;
    }
    if (aircraftWarning || aircraftConflictWarning || pilotConflictWarning) {
        toast({ title: "Error de Validación", description: aircraftWarning || aircraftConflictWarning || pilotConflictWarning || "Corrija los errores antes de guardar.", variant: "destructive" });
        setIsSubmittingForm(false);
        return;
    }
    
    try {
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
        if (!isRemolqueMode && durationMinutes > 0) {
          billableMins = durationMinutes;
        }
        
        const baseSubmissionData = {
            ...formData,
            date: format(formData.date, 'yyyy-MM-dd'),
            departure_time: depTimeCleaned,
            arrival_time: arrTimeCleaned,
            flight_duration_decimal: flightDurationDecimal,
            billable_minutes: billableMins,
            logbook_type: 'engine' as const,
        };

        let result;
        if (isEditMode) {
             const updatePayload = {
                ...baseSubmissionData,
                auth_user_id: initialFlightData?.auth_user_id || user.id, // Keep original author
            };
             result = await updateCompletedEngineFlight(flightIdToLoad!, updatePayload);
        } else if (isInstructionMode) {
            const purposesForEngine = purposes.filter(p => p.applies_to.includes('engine'));
            const impartidaPurposeId = purposesForEngine.find(p => p.name.includes('Impartida'))?.id;
            const recibidaPurposeId = purposesForEngine.find(p => p.name.includes('Recibida'))?.id;

            if (!impartidaPurposeId || !recibidaPurposeId) {
                throw new Error("No se encontraron los propósitos de vuelo de instrucción 'Impartida' o 'Recibida'.");
            }
            
            const studentRecord = {
                ...baseSubmissionData,
                pilot_id: formData.pilot_id,
                instructor_id: formData.instructor_id,
                flight_purpose_id: recibidaPurposeId,
                auth_user_id: user.id,
                oil_added_liters: baseSubmissionData.oil_added_liters,
                fuel_added_liters: baseSubmissionData.fuel_added_liters,
            };
            
            const instructorRecord = {
                ...baseSubmissionData,
                pilot_id: formData.instructor_id!, // Instructor is PIC on their record
                instructor_id: formData.pilot_id, // Student is the "instructor" for context
                flight_purpose_id: impartidaPurposeId,
                auth_user_id: user.id,
                oil_added_liters: null, 
                fuel_added_liters: null,
            };
            
            result = await addCompletedEngineFlight([studentRecord, instructorRecord]);

        } else {
             result = await addCompletedEngineFlight({ ...baseSubmissionData, auth_user_id: user.id });
        }

        if (result) {
            toast({ title: `Vuelo a Motor ${isEditMode ? 'Actualizado' : 'Registrado'}`, description: `El vuelo ha sido ${isEditMode ? 'actualizado' : 'guardado'} exitosamente.` });
            await fetchAircraft(true);
            router.push('/logbook/engine/list'); 
        } 
    } catch (error: any) {
        console.error(`Error during form submission (${isEditMode ? 'edit' : 'add'}):`, error);
        toast({ title: "Error Inesperado", description: error.message || "Ocurrió un error inesperado al procesar el formulario.", variant: "destructive" });
    } finally {
        setIsSubmittingForm(false);
    }
  };

  const isLoadingInitialData = pilotsLoading || aircraftLoading || categoriesLoading || scheduleLoading || (isEditMode && isFetchingFlightDetails) || purposesLoading;
  const isLoading = authLoading || isLoadingInitialData || submittingAddUpdate || isSubmittingForm;

  const isSubmitDisabled =
    isLoading ||
    isAnyPilotInvalidForFlight ||
    (categoryWarning != null && !user?.is_admin) ||
    !!aircraftWarning || !!pilotConflictWarning || !!aircraftConflictWarning;


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
         {isEditMode && initialFlightData?.pilot_id !== currentUserLinkedPilotId && initialFlightData?.instructor_id !== currentUserLinkedPilotId && user?.is_admin && (
            <Alert variant="default" className="mt-2 border-blue-500 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">Modo Administrador</AlertTitle>
                <AlertDescription className="text-blue-700/90">
                    Estás editando el vuelo de ${getPilotName(initialFlightData?.pilot_id)}.
                </AlertDescription>
            </Alert>
        )}
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {(aircraftConflictWarning || pilotConflictWarning) && (
                <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Conflicto de Horario</AlertTitle>
                    <AlertDescription>{aircraftConflictWarning || pilotConflictWarning}</AlertDescription>
                </Alert>
            )}
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
              name="flight_purpose_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Propósito del Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || isEditMode}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar propósito" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredPurposes.map((purpose) => (
                        <SelectItem key={purpose.id} value={purpose.id}>
                          {purpose.name}
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
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">{isInstructionMode ? 'Alumno' : 'Piloto'}</FormLabel>
                   <Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={isLoading}
                        >
                          {field.value ? getPilotName(field.value) : "Seleccionar piloto/alumno"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm} />
                        <CommandList>
                           {(!sortedStudents || sortedStudents.length === 0) && !pilotsLoading && !categoriesLoading ? (
                            <CommandEmpty>No hay pilotos con categoría para vuelo a motor.</CommandEmpty>
                          ) : (
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                          )}
                          <CommandGroup>
                            {sortedStudents.map((pilot) => (
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

            {isInstructionMode && (
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
                                  {sortedInstructorsForDropdown.map((pilot) => (
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
                      <Input 
                        type="text" 
                        placeholder="1430" 
                        {...field} 
                        onBlur={(e) => handleTimeInputBlur(e, 'departure_time')}
                        disabled={isLoading} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Use formato 24hs (ej: 1430).
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
                      <Input 
                        type="text" 
                        placeholder="1500" 
                        {...field} 
                        onBlur={(e) => handleTimeInputBlur(e, 'arrival_time')}
                        disabled={isLoading} />
                    </FormControl>
                     <FormDescription className="text-xs">
                       Use formato 24hs (ej: 1500).
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
                        <Input type="number" min="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading || !isRemolqueMode} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="oil_added_liters"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Aceite Agregado (Lts) (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" min="0" step="0.1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="fuel_added_liters"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Nafta Agregada (Lts) (Opcional)</FormLabel>
                        <FormControl>
                         <Input type="number" min="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading} />
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

    
