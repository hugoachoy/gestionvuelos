
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, isValid, differenceInMinutes, startOfDay, parse, isBefore, differenceInDays, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CompletedGliderFlight, Pilot, Aircraft, ScheduleEntry, PilotCategory, CompletedEngineFlight } from '@/types';
import { usePilotsStore, useAircraftStore, useCompletedGliderFlightsStore, useCompletedEngineFlightsStore, useScheduleStore, usePilotCategoriesStore, useFlightPurposesStore } from '@/store/data-hooks';
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
import { CalendarIcon, Check, ChevronsUpDown, AlertTriangle, Loader2, Save, Clock, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

const normalizeCategoryName = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

const INSTRUCTOR_PLANEADOR_KEYWORDS = ["instructor", "planeador"];
const PILOTO_PLANEADOR_KEYWORDS = ["piloto", "planeador"];
const REMOLCADOR_KEYWORDS = ["remolcador"];

const createGliderFlightSchema = () => z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  instructor_id: z.string().optional().nullable(),
  tow_pilot_id: z.string().min(1, "Seleccione un piloto remolcador."),
  glider_aircraft_id: z.string().min(1, "Seleccione un planeador."),
  tow_aircraft_id: z.string().min(1, "Seleccione un avión remolcador."),
  flight_purpose_id: z.string().min(1, "El propósito del vuelo es obligatorio."),
  departure_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de salida inválido (HH:MM)."),
  arrival_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de llegada inválido (HH:MM)."),
  notes: z.string().optional().nullable(),
  schedule_entry_id: z.string().optional().nullable(),
});

type GliderFlightFormData = z.infer<ReturnType<typeof createGliderFlightSchema>>;

interface GliderFlightFormClientProps {
  flightIdToLoad?: string;
}

export function GliderFlightFormClient({ flightIdToLoad }: GliderFlightFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { pilots, loading: pilotsLoading, fetchPilots, getPilotName } = usePilotsStore();
  const aircraftStore = useAircraftStore(); 
  const { aircraftWithCalculatedData, loading: aircraftLoading, fetchAircraft, getAircraftName } = aircraftStore;
  const { categories, loading: categoriesLoading, fetchCategories: fetchPilotCategories } = usePilotCategoriesStore();
  const { purposes, loading: purposesLoading, getPurposeName, fetchFlightPurposes } = useFlightPurposesStore();
  const { scheduleEntries, loading: scheduleLoading , fetchScheduleEntries } = useScheduleStore();
  const { addCompletedGliderFlight, updateCompletedGliderFlight, loading: submittingAddUpdate, completedGliderFlights, fetchCompletedGliderFlights } = useCompletedGliderFlightsStore();
  const { completedEngineFlights, fetchCompletedEngineFlights } = useCompletedEngineFlightsStore();

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [picPilotSearchTerm, setPicPilotSearchTerm] = useState('');
  const [picPilotPopoverOpen, setPicPilotPopoverOpen] = useState(false);
  const [instructorSearchTerm, setInstructorSearchTerm] = useState('');
  const [instructorPopoverOpen, setInstructorPopoverOpen] = useState(false);
  const [towPilotSearchTerm, setTowPilotSearchTerm] = useState('');
  const [towPilotPopoverOpen, setTowPilotPopoverOpen] = useState(false);
  const [medicalWarning, setMedicalWarning] = useState<string | null>(null);
  const [instructorMedicalWarning, setInstructorMedicalWarning] = useState<string | null>(null);
  const [towPilotMedicalWarning, setTowPilotMedicalWarning] = useState<string | null>(null);
  const [calculatedDuration, setCalculatedDuration] = useState<string | null>(null);
  const [gliderWarning, setGliderWarning] = useState<string | null>(null);
  const [towPlaneWarning, setTowPlaneWarning] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);


  const [isFetchingFlightDetails, setIsFetchingFlightDetails] = useState(false);
  const [flightFetchError, setFlightFetchError] = useState<string | null>(null);
  const [initialFlightData, setInitialFlightData] = useState<CompletedGliderFlight | null>(null);

  const isEditMode = !!flightIdToLoad;
  
  const form = useForm<GliderFlightFormData>({
    resolver: zodResolver(createGliderFlightSchema()),
    defaultValues: {
      date: new Date(),
      pilot_id: '',
      instructor_id: null,
      tow_pilot_id: '',
      glider_aircraft_id: '',
      tow_aircraft_id: '',
      flight_purpose_id: '',
      departure_time: '',
      arrival_time: '',
      notes: null,
      schedule_entry_id: null,
    },
  });
  
  const currentFlightPurposeId = form.watch('flight_purpose_id');
  const selectedPurpose = useMemo(() => purposes.find(p => p.id === currentFlightPurposeId), [purposes, currentFlightPurposeId]);
  
  const instructorPlaneadorCategoryId = useMemo(() => {
    if (categoriesLoading) return undefined;
    const category = categories.find(cat => {
      const normalized = normalizeCategoryName(cat.name);
      return INSTRUCTOR_PLANEADOR_KEYWORDS.every(kw => normalized.includes(kw));
    });
    return category?.id;
  }, [categories, categoriesLoading]);

  const scheduleEntryIdParam = searchParams.get('schedule_id');
  
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

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
    fetchCompletedGliderFlights();
    fetchCompletedEngineFlights();
    if (scheduleEntryIdParam && !isEditMode) {
      const dateParam = searchParams.get('date');
      if (dateParam) {
        fetchScheduleEntries(dateParam);
      }
    }
  }, [fetchPilots, fetchAircraft, fetchPilotCategories, fetchFlightPurposes, scheduleEntryIdParam, fetchScheduleEntries, isEditMode, fetchCompletedGliderFlights, fetchCompletedEngineFlights]);


  useEffect(() => {
    const loadFlightDetails = async () => {
      if (!user || pilots.length === 0 || aircraftWithCalculatedData.length === 0 || categories.length === 0 || purposes.length === 0) {
        return;
      }

      if (flightIdToLoad) {
        setIsFetchingFlightDetails(true);
        setFlightFetchError(null);
        setInitialFlightData(null);
        try {
          const { data, error: fetchError } = await supabase
            .from('completed_glider_flights')
            .select('*')
            .eq('id', flightIdToLoad)
            .single();

          if (fetchError) {
            if (fetchError.code === 'PGRST116' || !data) {
              setFlightFetchError("No se pudo encontrar el vuelo solicitado o no tienes permiso para editarlo.");
            } else {
              setFlightFetchError(fetchError.message || "Error al cargar los detalles del vuelo.");
            }
          } else if (data) {
            if (data.auth_user_id === user.id || user.is_admin) {
                setInitialFlightData(data);
                form.reset({
                    ...data,
                    date: data.date ? parseISO(data.date) : new Date(),
                    instructor_id: data.instructor_id || null,
                    notes: data.notes || null,
                    schedule_entry_id: data.schedule_entry_id || null,
                    departure_time: data.departure_time ? data.departure_time.substring(0,5) : '',
                    arrival_time: data.arrival_time ? data.arrival_time.substring(0,5) : '',
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

    if (isEditMode) { 
      loadFlightDetails();
    } else if (!isEditMode && scheduleEntryIdParam && scheduleEntries && scheduleEntries.length > 0 && pilots.length > 0 && aircraftWithCalculatedData.length > 0 && purposes.length > 0) {
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
              glider_aircraft_id: entry.aircraft_id || '',
              departure_time: entry.start_time ? entry.start_time.substring(0,5) : '',
              schedule_entry_id: entry.id,
              instructor_id: null,
              tow_pilot_id: '',
              tow_aircraft_id: '',
              flight_purpose_id: correspondingPurpose?.id || '',
              arrival_time: '',
              notes: null,
            });
        }
    } else if (!isEditMode && !scheduleEntryIdParam && pilots.length > 0 && aircraftWithCalculatedData.length > 0 && user) {
        form.reset({
            date: new Date(),
            pilot_id: pilots.find(p => p.auth_user_id === user.id)?.id || '',
            instructor_id: null,
            tow_pilot_id: '',
            glider_aircraft_id: '',
            tow_aircraft_id: '',
            flight_purpose_id: '',
            departure_time: '',
            arrival_time: '',
            notes: null,
            schedule_entry_id: null,
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, flightIdToLoad, user, scheduleEntryIdParam, scheduleEntries, pilots.length, aircraftWithCalculatedData.length, categories.length, purposes.length]); 


  const watchedPicPilotId = form.watch("pilot_id");
  const watchedInstructorId = form.watch("instructor_id");
  const watchedTowPilotId = form.watch("tow_pilot_id");
  const watchedDate = form.watch("date");
  const watchedDepartureTime = form.watch('departure_time');
  const watchedArrivalTime = form.watch('arrival_time');
  
  const watchedGliderAircraftId = form.watch("glider_aircraft_id");
  const watchedTowAircraftId = form.watch("tow_aircraft_id");

  const isInstructionMode = useMemo(() => selectedPurpose?.name.includes('Instrucción'), [selectedPurpose]);
  
  useEffect(() => {
    if (!isInstructionMode && form.getValues("instructor_id") !== null) {
      form.setValue("instructor_id", null, { shouldValidate: true });
      setInstructorSearchTerm('');
    }
  }, [isInstructionMode, form]);


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

    const checkPilotMedical = useCallback((pilotId: string | null | undefined, date: Date | undefined, pilotRole: string): string | null => {
      if (!pilotId || !date || !pilots.length) {
        return null;
      }
      const pilot = pilots.find(p => p.id === pilotId);
      if (!pilot?.medical_expiry) {
        return null;
      }
      const medicalExpiryDate = parseISO(pilot.medical_expiry);
      const flightDate = startOfDay(date);
      if (isValid(medicalExpiryDate)) {
        if (isBefore(medicalExpiryDate, flightDate)) {
          return `¡Psicofísico de ${pilotRole} VENCIDO el ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })}!`;
        }
        const daysDiff = differenceInDays(medicalExpiryDate, flightDate);
        if (daysDiff <= 30) {
          return `Psicofísico de ${pilotRole} vence pronto: ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })} (${daysDiff} días).`;
        }
      }
      return null;
    }, [pilots]);

  useEffect(() => {
    setMedicalWarning(checkPilotMedical(watchedPicPilotId, watchedDate, 'Piloto'));
    setInstructorMedicalWarning(checkPilotMedical(watchedInstructorId, watchedDate, 'Instructor'));
    setTowPilotMedicalWarning(checkPilotMedical(watchedTowPilotId, watchedDate, 'Piloto Remolcador'));
  }, [watchedPicPilotId, watchedInstructorId, watchedTowPilotId, watchedDate, checkPilotMedical]);

  useEffect(() => {
    setGliderWarning(null);
    if (watchedGliderAircraftId && watchedDate && isValid(watchedDate)) {
      const selectedAC = aircraftWithCalculatedData.find(ac => ac.id === watchedGliderAircraftId);
      if (selectedAC) {
        const flightDateStart = startOfDay(watchedDate);
        const isInsuranceExpiredOnFlightDate = selectedAC.insurance_expiry_date && isValid(parseISO(selectedAC.insurance_expiry_date)) && isBefore(parseISO(selectedAC.insurance_expiry_date), flightDateStart);
        if (selectedAC.is_out_of_service) {
          setGliderWarning(`El planeador "${selectedAC.name}" está fuera de servicio.`);
        } else if (isInsuranceExpiredOnFlightDate) {
          setGliderWarning(`El seguro del planeador "${selectedAC.name}" estaba vencido en la fecha del vuelo.`);
        }
      }
    }
  }, [watchedGliderAircraftId, aircraftWithCalculatedData, watchedDate]);

  useEffect(() => {
    setTowPlaneWarning(null);
    if (watchedTowAircraftId && watchedDate && isValid(watchedDate)) {
      const selectedAC = aircraftWithCalculatedData.find(ac => ac.id === watchedTowAircraftId);
      if (selectedAC) {
        const flightDateStart = startOfDay(watchedDate);
        const isInsuranceExpiredOnFlightDate = selectedAC.insurance_expiry_date && isValid(parseISO(selectedAC.insurance_expiry_date)) && isBefore(parseISO(selectedAC.insurance_expiry_date), flightDateStart);
        if (selectedAC.is_out_of_service) {
          setTowPlaneWarning(`El avión remolcador "${selectedAC.name}" está fuera de servicio.`);
        } else if (isInsuranceExpiredOnFlightDate) {
          setTowPlaneWarning(`El seguro del avión remolcador "${selectedAC.name}" estaba vencido en la fecha del vuelo.`);
        }
      }
    }
  }, [watchedTowAircraftId, aircraftWithCalculatedData, watchedDate]);

   const checkAircraftConflict = useCallback(() => {
        const { date, departure_time, arrival_time, glider_aircraft_id } = form.getValues();

        if (!date || !departure_time || !arrival_time || !glider_aircraft_id || !/^\d{2}:\d{2}/.test(departure_time) || !/^\d{2}:\d{2}/.test(arrival_time)) {
            setConflictWarning(null);
            return;
        }

        const newDepartureDateTime = parse(departure_time, 'HH:mm', date);
        const newArrivalDateTime = parse(arrival_time, 'HH:mm', date);

        if (!isValid(newDepartureDateTime) || !isValid(newArrivalDateTime) || isBefore(newArrivalDateTime, newDepartureDateTime)) {
            setConflictWarning(null);
            return;
        }
        
        const conflictingGliderFlight = completedGliderFlights.find(flight => {
            if (isEditMode && flight.id === flightIdToLoad) return false;
            if (flight.glider_aircraft_id !== glider_aircraft_id) return false;
            if (flight.date !== format(date, 'yyyy-MM-dd')) return false;

            const existingDeparture = parse(flight.departure_time, 'HH:mm', parseISO(flight.date));
            const existingArrival = parse(flight.arrival_time, 'HH:mm', parseISO(flight.date));

            if (!isValid(existingDeparture) || !isValid(existingArrival)) return false;
            
            // Check for overlap: max(start1, start2) < min(end1, end2)
            return Math.max(newDepartureDateTime.getTime(), existingDeparture.getTime()) < Math.min(newArrivalDateTime.getTime(), existingArrival.getTime());
        });

        if (conflictingGliderFlight) {
            setConflictWarning("Conflicto de Horario: Este planeador ya tiene un vuelo registrado en este rango horario.");
        } else {
            setConflictWarning(null);
        }

    }, [form, completedGliderFlights, isEditMode, flightIdToLoad]);
    
    useEffect(() => {
        checkAircraftConflict();
    }, [watchedDate, watchedDepartureTime, watchedArrivalTime, watchedGliderAircraftId, checkAircraftConflict]);


  const gliderPilotCategoryIds = useMemo(() => {
    if (categoriesLoading || !categories.length) return [];
    return categories
      .filter(cat => {
        const normalizedName = normalizeCategoryName(cat.name);
        const isPiloto = PILOTO_PLANEADOR_KEYWORDS.every(kw => normalizedName.includes(kw));
        const isInstructor = INSTRUCTOR_PLANEADOR_KEYWORDS.every(kw => normalizedName.includes(kw));
        return isPiloto || isInstructor;
      })
      .map(cat => cat.id);
  }, [categories, categoriesLoading]);

  const sortedPilotsForGlider = useMemo(() => {
    if (pilotsLoading || !pilots.length || !gliderPilotCategoryIds.length) return [];
    return pilots
      .filter(pilot => pilot.category_ids.some(catId => gliderPilotCategoryIds.includes(catId)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotsLoading, gliderPilotCategoryIds]);

  const sortedStudents = useMemo(() => {
    if (pilotsLoading || !pilots.length) return [];
    return sortedPilotsForGlider;
  }, [pilotsLoading, sortedPilotsForGlider]);


  const sortedInstructorsForDropdown = useMemo(() => {
      if (!instructorPlaneadorCategoryId) return [];
      return pilots
        .filter(pilot => 
            pilot.category_ids.includes(instructorPlaneadorCategoryId) &&
            pilot.id !== watchedPicPilotId
        )
        .sort((a,b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, instructorPlaneadorCategoryId, watchedPicPilotId]);

  const towPilotCategoryId = useMemo(() => {
    if (categoriesLoading) return undefined;
    const category = categories.find(cat => {
        const normalized = normalizeCategoryName(cat.name);
        return REMOLCADOR_KEYWORDS.every(kw => normalized.includes(kw));
    });
    return category?.id;
  }, [categories, categoriesLoading]);
  
  const sortedTowPilots = useMemo(() => {
    if (!towPilotCategoryId) return [];
    return pilots
      .filter(pilot => 
          pilot.category_ids.includes(towPilotCategoryId) &&
          pilot.id !== watchedPicPilotId &&
          pilot.id !== watchedInstructorId
      )
      .sort((a,b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, towPilotCategoryId, watchedPicPilotId, watchedInstructorId]);


  const filteredGliders = useMemo(() => {
    return aircraftWithCalculatedData.filter(ac => ac.type === 'Glider').sort((a,b) => a.name.localeCompare(b.name));
  }, [aircraftWithCalculatedData]);

  const filteredTowPlanes = useMemo(() => {
    return aircraftWithCalculatedData.filter(ac => ac.type === 'Tow Plane').sort((a,b) => a.name.localeCompare(b.name));
  }, [aircraftWithCalculatedData]);

  const filteredPurposes = useMemo(() => {
      return purposes.filter(p => p.applies_to.includes('glider'));
  }, [purposes]);

  const isAnyPilotInvalidForFlight = useMemo(() => {
    const isPicExpired = medicalWarning?.toUpperCase().includes("VENCIDO");
    const isInstructorExpired = instructorMedicalWarning?.toUpperCase().includes("VENCIDO");
    const isTowPilotExpired = towPilotMedicalWarning?.toUpperCase().includes("VENCIDO");
    return !!(isPicExpired || isInstructorExpired || isTowPilotExpired);
  }, [medicalWarning, instructorMedicalWarning, towPilotMedicalWarning]);

  const onSubmit = async (formData: GliderFlightFormData) => {
    setIsSubmittingForm(true);

    if (!user) {
        toast({ title: "Error", description: "Debes estar autenticado para registrar un vuelo.", variant: "destructive" });
        setIsSubmittingForm(false);
        return;
    }
    if (gliderWarning || towPlaneWarning || conflictWarning) {
        let errorMessages: string[] = [];
        if (gliderWarning) errorMessages.push(gliderWarning);
        if (towPlaneWarning) errorMessages.push(towPlaneWarning);
        if (conflictWarning) errorMessages.push(conflictWarning);
        toast({
            title: "Error de Validación",
            description: `No se puede registrar el vuelo. Problemas: ${errorMessages.join(' ')}`,
            variant: "destructive",
            duration: 7000,
        });
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

        const baseSubmissionData = {
            ...formData,
            date: format(formData.date, 'yyyy-MM-dd'),
            departure_time: depTimeCleaned,
            arrival_time: arrTimeCleaned,
            flight_duration_decimal: flightDurationDecimal,
            schedule_entry_id: formData.schedule_entry_id || null,
            notes: formData.notes || null,
        };
        
        let result;
        if (isEditMode && flightIdToLoad) {
            const updatePayload = {
                ...baseSubmissionData,
                auth_user_id: initialFlightData?.auth_user_id || user.id, // Keep original author
            };
            result = await updateCompletedGliderFlight(flightIdToLoad, updatePayload);
        } else if (isInstructionMode) {
             const purposesForGlider = purposes.filter(p => p.applies_to.includes('glider'));
             const impartidaPurposeId = purposesForGlider.find(p => p.name.includes('Impartida'))?.id;
             const recibidaPurposeId = purposesForGlider.find(p => p.name.includes('Recibida'))?.id;

             if (!impartidaPurposeId || !recibidaPurposeId) {
                 throw new Error("No se encontraron los propósitos de vuelo de instrucción 'Impartida' o 'Recibida'.");
             }
             
             const studentRecord = {
                ...baseSubmissionData,
                pilot_id: formData.pilot_id,
                instructor_id: formData.instructor_id,
                flight_purpose_id: recibidaPurposeId,
                auth_user_id: user.id,
             };

             const instructorRecord = {
                ...baseSubmissionData,
                pilot_id: formData.pilot_id,
                instructor_id: formData.instructor_id,
                flight_purpose_id: impartidaPurposeId,
                auth_user_id: user.id,
             };
             
             result = await addCompletedGliderFlight([studentRecord, instructorRecord]);

        } else {
            result = await addCompletedGliderFlight([{
                ...baseSubmissionData,
                logbook_type: 'glider',
                auth_user_id: user.id,
            }]);
        }

        if (result) {
            toast({ title: `Vuelo en Planeador ${isEditMode ? 'Actualizado' : 'Registrado'}`, description: `El vuelo ha sido ${isEditMode ? 'actualizado' : 'guardado'} exitosamente.` });
            router.push('/logbook/glider/list');
        }
    } catch (error: any) {
        console.error(`Error during form submission (${isEditMode ? 'edit' : 'add'}):`, error);
        toast({ title: "Error Inesperado", description: error.message || "Ocurrió un error inesperado al procesar el formulario.", variant: "destructive" });
    } finally {
        setIsSubmittingForm(false);
    }
  };

  const isLoading = authLoading || pilotsLoading || aircraftLoading || categoriesLoading || scheduleLoading || purposesLoading || submittingAddUpdate || isSubmittingForm || (isEditMode && isFetchingFlightDetails);
  const isSubmitDisabled = isLoading || isAnyPilotInvalidForFlight || !!gliderWarning || !!towPlaneWarning || !!conflictWarning;

  if (authLoading && !user) { 
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditMode ? 'Cargando Editor de Vuelo...' : 'Cargando Formulario...'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6">
          <Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-32" />
        </CardFooter>
      </Card>
    );
  }

  if (!user && !authLoading) { 
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>{isEditMode ? 'Editar Vuelo en Planeador' : 'Detalles del Vuelo en Planeador'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Autenticación Requerida</AlertTitle>
            <AlertDescription>
              Debes iniciar sesión para {isEditMode ? 'editar' : 'registrar'} un vuelo.
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

  if (isEditMode && isFetchingFlightDetails && user) {
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

  if (isEditMode && flightFetchError && user) {
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
                <Button asChild variant="outline"><Link href="/logbook/glider/list">Volver al listado</Link></Button>
            </CardFooter>
        </Card>
    );
  }


  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditMode ? 'Editar Vuelo en Planeador' : 'Detalles del Vuelo en Planeador'}</CardTitle>
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
            {conflictWarning && (
                <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Conflicto de Horario</AlertTitle>
                    <AlertDescription>{conflictWarning}</AlertDescription>
                </Alert>
            )}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Fecha del Vuelo</FormLabel>
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
                        disabled={(date) => date > new Date() || isLoading }
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
              name="pilot_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Piloto / Alumno</FormLabel>
                   <Popover open={picPilotPopoverOpen} onOpenChange={setPicPilotPopoverOpen}>
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
                        <CommandInput placeholder="Buscar piloto..." value={picPilotSearchTerm} onValueChange={setPicPilotSearchTerm}/>
                        <CommandList>
                          {(!sortedPilotsForGlider || sortedPilotsForGlider.length === 0) && !pilotsLoading && !categoriesLoading ? (
                            <CommandEmpty>No hay pilotos con categoría para vuelo en planeador.</CommandEmpty>
                          ) : (
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                          )}
                          <CommandGroup>
                             {sortedPilotsForGlider.map((pilot) => (
                              <CommandItem
                                value={`${pilot.last_name}, ${pilot.first_name}`}
                                key={pilot.id}
                                onSelect={() => {
                                  form.setValue("pilot_id", pilot.id, { shouldValidate: true });
                                  setPicPilotPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")}/>
                                {pilot.last_name}, {pilot.first_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {(!sortedPilotsForGlider || sortedPilotsForGlider.length === 0) && !pilotsLoading && !categoriesLoading && (
                    <FormDescription className="text-xs text-destructive">
                        No hay pilotos habilitados para vuelos en planeador. Verifique las categorías de los pilotos.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {medicalWarning && (
              <Alert variant={medicalWarning.toUpperCase().includes("VENCIDO") ? "destructive" : "default"} className={!medicalWarning.toUpperCase().includes("VENCIDO") ? "border-yellow-500" : ""}>
                <AlertTriangle className={cn("h-4 w-4", !medicalWarning.toUpperCase().includes("VENCIDO") && "text-yellow-600")} />
                <AlertTitle>{medicalWarning.toUpperCase().includes("VENCIDO") ? "Psicofísico Vencido" : "Advertencia de Psicofísico"}</AlertTitle>
                <AlertDescription>{medicalWarning}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="flight_purpose_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Propósito del Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isAnyPilotInvalidForFlight || isLoading || isEditMode}>
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
            
            {isInstructionMode && (
              <FormField
                control={form.control}
                name="instructor_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Instructor</FormLabel>
                    <Popover open={instructorPopoverOpen} onOpenChange={setInstructorPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                            disabled={isAnyPilotInvalidForFlight || isLoading || !instructorPlaneadorCategoryId}
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
                            <CommandEmpty>No se encontraron instructores de planeador.</CommandEmpty>
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
                                  <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")}/>
                                  {pilot.last_name}, {pilot.first_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {!instructorPlaneadorCategoryId && !categoriesLoading && <FormDescription className="text-xs text-destructive">No se encontró una categoría que contenga "Instructor" y "Planeador". Por favor, créela.</FormDescription>}
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
              name="tow_pilot_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Piloto Remolcador</FormLabel>
                   <Popover open={towPilotPopoverOpen} onOpenChange={setTowPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={isAnyPilotInvalidForFlight || isLoading || !towPilotCategoryId}
                        >
                          {field.value ? getPilotName(field.value) : "Seleccionar piloto remolcador"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar piloto..." value={towPilotSearchTerm} onValueChange={setTowPilotSearchTerm}/>
                        <CommandList>
                          <CommandEmpty>No se encontraron pilotos remolcadores.</CommandEmpty>
                          <CommandGroup>
                            {sortedTowPilots.map((pilot) => (
                              <CommandItem
                                value={`${pilot.last_name}, ${pilot.first_name}`}
                                key={pilot.id}
                                onSelect={() => {
                                  form.setValue("tow_pilot_id", pilot.id, { shouldValidate: true });
                                  setTowPilotPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")}/>
                                {pilot.last_name}, {pilot.first_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!towPilotCategoryId && !categoriesLoading && <FormDescription className="text-xs text-destructive">No se encontró la categoría "Remolcador". Por favor, créela.</FormDescription>}
                  <FormMessage />
                  {towPilotMedicalWarning && (
                      <Alert variant={towPilotMedicalWarning.toUpperCase().includes("VENCIDO") ? "destructive" : "default"} className="mt-2 text-xs">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{towPilotMedicalWarning}</AlertDescription>
                      </Alert>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="glider_aircraft_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Planeador</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isAnyPilotInvalidForFlight || isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar planeador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredGliders.map((ac) => {
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
                            {ac.name} {isEffectivelyOutOfService && ` ${outOfServiceReason}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             {gliderWarning && (
                <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Planeador no disponible</AlertTitle>
                    <AlertDescription>{gliderWarning}</AlertDescription>
                </Alert>
            )}

            <FormField
              control={form.control}
              name="tow_aircraft_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Avión Remolcador</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isAnyPilotInvalidForFlight || isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar avión remolcador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredTowPlanes.map((ac) => {
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
                            {ac.name} {isEffectivelyOutOfService && ` ${outOfServiceReason}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {towPlaneWarning && (
                <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Remolcador no disponible</AlertTitle>
                    <AlertDescription>{towPlaneWarning}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="departure_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Hora de Salida (HH:MM)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="0900"
                        {...field}
                        onBlur={(e) => handleTimeInputBlur(e, 'departure_time')}
                        disabled={isAnyPilotInvalidForFlight || isLoading}
                      />
                    </FormControl>
                     <FormDescription className="text-xs">
                      Use formato 24hs (ej: 0900).
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
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Hora de Llegada (HH:MM)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="1030"
                        {...field}
                        onBlur={(e) => handleTimeInputBlur(e, 'arrival_time')}
                        disabled={isAnyPilotInvalidForFlight || isLoading}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Use formato 24hs (ej: 1030).
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Anotaciones adicionales sobre el vuelo..." {...field} value={field.value ?? ""} disabled={isAnyPilotInvalidForFlight || isLoading}/>
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
              {isEditMode ? 'Guardar Cambios' : 'Guardar Vuelo'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
