
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, isValid, differenceInMinutes, startOfDay, parse, isBefore, differenceInDays, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CompletedGliderFlight, Pilot, Aircraft, ScheduleEntry, PilotCategory, GliderFlightPurpose, FlightTypeId } from '@/types';
import { GLIDER_FLIGHT_PURPOSES, FLIGHT_TYPES, FLIGHT_PURPOSE_DISPLAY_MAP } from '@/types';
import { usePilotsStore, useAircraftStore, useCompletedGliderFlightsStore, useScheduleStore, usePilotCategoriesStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client for direct calls

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
  // More robust normalization: handle undefined, trim, lowercase, and remove diacritics
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

// Use keywords for more flexible matching
const INSTRUCTOR_PLANEADOR_KEYWORDS = ["instructor", "planeador"];
const PILOTO_PLANEADOR_KEYWORDS = ["piloto", "planeador"];
const REMOLCADOR_KEYWORDS = ["remolcador"];


const gliderFlightSchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  instructor_id: z.string().optional().nullable(),
  tow_pilot_id: z.string().min(1, "Seleccione un piloto remolcador."),
  glider_aircraft_id: z.string().min(1, "Seleccione un planeador."),
  tow_aircraft_id: z.string().min(1, "Seleccione un avión remolcador."),
  flight_purpose: z.enum(GLIDER_FLIGHT_PURPOSES, { required_error: "El propósito del vuelo es obligatorio." }),
  departure_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de salida inválido (HH:MM)."),
  arrival_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de llegada inválido (HH:MM)."),
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
}).refine(data => data.pilot_id !== data.tow_pilot_id, {
  message: "El piloto no puede ser su propio piloto remolcador.",
  path: ["tow_pilot_id"],
}).refine(data => !data.instructor_id || data.instructor_id !== data.tow_pilot_id, {
  message: "El instructor no puede ser el piloto remolcador.",
  path: ["tow_pilot_id"],
}).refine(data => {
  if ((data.flight_purpose === 'Instrucción (Recibida)' || data.flight_purpose === 'readaptación') && !data.instructor_id) {
    return false;
  }
  return true;
}, {
  message: "Se requiere un instructor para 'Instrucción (Recibida)' o 'Readaptación'.",
  path: ["instructor_id"],
});


type GliderFlightFormData = z.infer<typeof gliderFlightSchema>;

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
  const { aircraft, loading: aircraftLoading, fetchAircraft, getAircraftName: getAircraftFullName } = aircraftStore;
  const { categories, loading: categoriesLoading, fetchCategories: fetchPilotCategories } = usePilotCategoriesStore();
  const { scheduleEntries, loading: scheduleLoading , fetchScheduleEntries } = useScheduleStore();
  const { addCompletedGliderFlight, updateCompletedGliderFlight, loading: submittingAddUpdate, completedGliderFlights, fetchCompletedGliderFlights } = useCompletedGliderFlightsStore();

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

  const [isFetchingFlightDetails, setIsFetchingFlightDetails] = useState(false);
  const [flightFetchError, setFlightFetchError] = useState<string | null>(null);
  const [initialFlightData, setInitialFlightData] = useState<CompletedGliderFlight | null>(null);

  const isEditMode = !!flightIdToLoad;

  const form = useForm<GliderFlightFormData>({
    resolver: zodResolver(gliderFlightSchema),
    defaultValues: {
      date: new Date(),
      pilot_id: '',
      instructor_id: null,
      tow_pilot_id: '',
      glider_aircraft_id: '',
      tow_aircraft_id: '',
      flight_purpose: undefined,
      departure_time: '',
      arrival_time: '',
      notes: null,
      schedule_entry_id: null,
    },
  });

  const scheduleEntryIdParam = searchParams.get('schedule_id');
  
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

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
    if (!isEditMode) {
      fetchCompletedGliderFlights();
    }
    if (scheduleEntryIdParam && !isEditMode) {
      const dateParam = searchParams.get('date');
      if (dateParam) {
        fetchScheduleEntries(dateParam);
      }
    }
  }, [fetchPilots, fetchAircraft, fetchPilotCategories, fetchCompletedGliderFlights, scheduleEntryIdParam, fetchScheduleEntries, isEditMode]);


  useEffect(() => {
    const loadFlightDetails = async () => {
      if (flightIdToLoad && user) {
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

    if (isEditMode && user) { 
      loadFlightDetails();
    } else if (!isEditMode && scheduleEntryIdParam && scheduleEntries.length > 0 && pilots.length > 0 && aircraft.length > 0) {
        const entry = scheduleEntries.find(e => e.id === scheduleEntryIdParam);
        if (entry) {
            const prefilledFlightPurpose = (GLIDER_FLIGHT_PURPOSES as readonly string[]).includes(entry.flight_type_id) ? entry.flight_type_id as GliderFlightPurpose : undefined;

            form.reset({
              date: entry.date ? parseISO(entry.date) : new Date(),
              pilot_id: entry.pilot_id || '',
              glider_aircraft_id: entry.aircraft_id || '',
              departure_time: entry.start_time ? entry.start_time.substring(0,5) : '',
              schedule_entry_id: entry.id,
              instructor_id: null,
              tow_pilot_id: '',
              tow_aircraft_id: '',
              flight_purpose: prefilledFlightPurpose,
              arrival_time: '',
              notes: null,
            });
        }
    } else if (!isEditMode && !scheduleEntryIdParam && pilots.length > 0 && aircraft.length > 0 && user) {
        form.reset({
            date: new Date(),
            pilot_id: pilots.find(p => p.auth_user_id === user.id)?.id || '',
            instructor_id: null,
            tow_pilot_id: '',
            glider_aircraft_id: '',
            tow_aircraft_id: '',
            flight_purpose: undefined,
            departure_time: '',
            arrival_time: '',
            notes: null,
            schedule_entry_id: null,
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, flightIdToLoad, user, scheduleEntryIdParam, scheduleEntries.length, pilots.length, aircraft.length]); 


  const watchedPicPilotId = form.watch("pilot_id");
  const watchedInstructorId = form.watch("instructor_id");
  const watchedTowPilotId = form.watch("tow_pilot_id");
  const watchedDate = form.watch("date");
  const watchedDepartureTime = form.watch('departure_time');
  const watchedArrivalTime = form.watch('arrival_time');
  const watchedFlightPurpose = form.watch('flight_purpose');
  const watchedGliderAircraftId = form.watch("glider_aircraft_id");
  const watchedTowAircraftId = form.watch("tow_aircraft_id");

  const isInstructionGivenMode = useMemo(() => watchedFlightPurpose === 'Instrucción (Impartida)', [watchedFlightPurpose]);
  const isInstructionTakenMode = useMemo(() => watchedFlightPurpose === 'Instrucción (Recibida)' || watchedFlightPurpose === 'readaptación', [watchedFlightPurpose]);
  const picOrStudentLabel = isInstructionGivenMode ? 'Alumno' : 'Piloto a Cargo';

  useEffect(() => {
    if (!isInstructionTakenMode && form.getValues("instructor_id") !== null) {
      form.setValue("instructor_id", null, { shouldValidate: true });
      setInstructorSearchTerm('');
    }
  }, [isInstructionTakenMode, form]);


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


  useEffect(() => {
    const checkPilotMedical = (pilotId: string | null | undefined, date: Date | undefined, pilotRole: string): string | null => {
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
    };

    setMedicalWarning(checkPilotMedical(watchedPicPilotId, watchedDate, picOrStudentLabel));
    setInstructorMedicalWarning(checkPilotMedical(watchedInstructorId, watchedDate, 'Instructor'));
    setTowPilotMedicalWarning(checkPilotMedical(watchedTowPilotId, watchedDate, 'Piloto Remolcador'));
  }, [watchedPicPilotId, watchedInstructorId, watchedTowPilotId, watchedDate, pilots, picOrStudentLabel]);

  useEffect(() => {
    setGliderWarning(null);
    if (watchedGliderAircraftId && watchedDate && isValid(watchedDate)) {
      const selectedAC = aircraft.find(ac => ac.id === watchedGliderAircraftId);
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
  }, [watchedGliderAircraftId, aircraft, watchedDate]);

  useEffect(() => {
    setTowPlaneWarning(null);
    if (watchedTowAircraftId && watchedDate && isValid(watchedDate)) {
      const selectedAC = aircraft.find(ac => ac.id === watchedTowAircraftId);
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
  }, [watchedTowAircraftId, aircraft, watchedDate]);

  const sortedPilots = useMemo(() => {
    return [...pilots].sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots]);

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

  const sortedPilotsForPic = useMemo(() => {
    if (pilotsLoading || !pilots.length || !gliderPilotCategoryIds.length) return [];
    let availablePilots = [...pilots];
    // If the user is an instructor giving a class, they can't be their own student.
    if (isInstructionGivenMode && currentUserLinkedPilotId) {
        availablePilots = availablePilots.filter(p => p.id !== currentUserLinkedPilotId);
    }
    
    return availablePilots
      .filter(pilot => pilot.category_ids.some(catId => gliderPilotCategoryIds.includes(catId)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotsLoading, gliderPilotCategoryIds, isInstructionGivenMode, currentUserLinkedPilotId]);

  const instructorPlaneadorCategoryId = useMemo(() => {
    if (categoriesLoading) return undefined;
    const category = categories.find(cat => {
      const normalized = normalizeCategoryName(cat.name);
      return INSTRUCTOR_PLANEADOR_KEYWORDS.every(kw => normalized.includes(kw));
    });
    return category?.id;
  }, [categories, categoriesLoading]);

  const towPilotCategoryId = useMemo(() => {
    if (categoriesLoading) return undefined;
    const category = categories.find(cat => {
        const normalized = normalizeCategoryName(cat.name);
        return REMOLCADOR_KEYWORDS.every(kw => normalized.includes(kw));
    });
    return category?.id;
  }, [categories, categoriesLoading]);

  const sortedInstructors = useMemo(() => {
    if (!instructorPlaneadorCategoryId) return [];
    return sortedPilots.filter(pilot =>
      pilot.category_ids.includes(instructorPlaneadorCategoryId) &&
      pilot.id !== watchedPicPilotId
    );
  }, [sortedPilots, instructorPlaneadorCategoryId, watchedPicPilotId]);

  const sortedTowPilots = useMemo(() => {
    if (!towPilotCategoryId) return [];
    return sortedPilots.filter(pilot =>
      pilot.category_ids.includes(towPilotCategoryId) &&
      pilot.id !== watchedPicPilotId &&
      pilot.id !== watchedInstructorId
    );
  }, [sortedPilots, towPilotCategoryId, watchedPicPilotId, watchedInstructorId]);


  const filteredGliders = useMemo(() => {
    return aircraft.filter(ac => ac.type === 'Glider').sort((a,b) => a.name.localeCompare(b.name));
  }, [aircraft]);

  const filteredTowPlanes = useMemo(() => {
    return aircraft.filter(ac => ac.type === 'Tow Plane').sort((a,b) => a.name.localeCompare(b.name));
  }, [aircraft]);

  const isAnyPilotInvalidForFlight = useMemo(() => {
    const isPicExpired = medicalWarning?.toUpperCase().includes("VENCIDO");
    const isInstructorExpired = instructorMedicalWarning?.toUpperCase().includes("VENCIDO");
    const isTowPilotExpired = towPilotMedicalWarning?.toUpperCase().includes("VENCIDO");
    return !!(isPicExpired || isInstructorExpired || isTowPilotExpired);
  }, [medicalWarning, instructorMedicalWarning, towPilotMedicalWarning]);

  const onSubmit = async (formData: GliderFlightFormData) => {
    setIsSubmittingForm(true);
    try {
        if (!user) {
            toast({ title: "Error", description: "Debes estar autenticado para registrar un vuelo.", variant: "destructive" });
            setIsSubmittingForm(false);
            return;
        }
        if (gliderWarning) {
            toast({ title: "Error de Aeronave", description: gliderWarning, variant: "destructive" });
            setIsSubmittingForm(false);
            return;
        }
        if (towPlaneWarning) {
            toast({ title: "Error de Aeronave", description: towPlaneWarning, variant: "destructive" });
            setIsSubmittingForm(false);
            return;
        }
        if (isAnyPilotInvalidForFlight) {
            let errorMessages: string[] = [];
            if (medicalWarning?.toUpperCase().includes("VENCIDO")) errorMessages.push(medicalWarning);
            if (instructorMedicalWarning?.toUpperCase().includes("VENCIDO")) errorMessages.push(instructorMedicalWarning);
            if (towPilotMedicalWarning?.toUpperCase().includes("VENCIDO")) errorMessages.push(towPilotMedicalWarning);
            toast({
                title: "Error de Psicofísico Vencido",
                description: `No se puede registrar el vuelo. Por favor, revise los siguientes problemas: ${errorMessages.join(' ')}`,
                variant: "destructive",
                duration: 7000,
            });
            setIsSubmittingForm(false);
            return;
        }
        
        let finalPilotId = formData.pilot_id;
        let finalInstructorId: string | null | undefined = null;

        if (isInstructionTakenMode) {
            finalInstructorId = formData.instructor_id;
        } else if (isInstructionGivenMode) {
            finalInstructorId = null;
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

        const submissionData = {
            ...formData,
            pilot_id: finalPilotId,
            instructor_id: finalInstructorId,
            date: format(formData.date, 'yyyy-MM-dd'),
            departure_time: depTimeCleaned,
            arrival_time: arrTimeCleaned,
            flight_duration_decimal: flightDurationDecimal,
            schedule_entry_id: formData.schedule_entry_id || null,
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
            const { id, created_at, logbook_type, auth_user_id, ...restOfInitialData } = initialFlightData;
            const updatePayload = { ...restOfInitialData, ...submissionData };
            result = await updateCompletedGliderFlight(flightIdToLoad, updatePayload);
        } else if (!isEditMode) {
             if (!flightIdToLoad || flightIdToLoad.trim() === '') {
                result = await addCompletedGliderFlight({
                    ...submissionData,
                    logbook_type: 'glider',
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
            toast({ title: `Vuelo en Planeador ${isEditMode ? 'Actualizado' : 'Registrado'}`, description: `El vuelo ha sido ${isEditMode ? 'actualizado' : 'guardado'} exitosamente.` });
            await fetchCompletedGliderFlights();
            router.push('/logbook/glider/list');
        } else {
            toast({ title: `Error al ${isEditMode ? 'Actualizar' : 'Registrar'}`, description: `No se pudo ${isEditMode ? 'actualizar' : 'guardar'} el vuelo. Intenta de nuevo.`, variant: "destructive" });
        }
    } catch (error) {
        console.error(`Error during form submission (${isEditMode ? 'edit' : 'add'}):`, error);
        toast({ title: "Error Inesperado", description: "Ocurrió un error inesperado al procesar el formulario.", variant: "destructive" });
    } finally {
        setIsSubmittingForm(false);
    }
  };

  const isLoading = authLoading || pilotsLoading || aircraftLoading || categoriesLoading || scheduleLoading || submittingAddUpdate || isSubmittingForm || (isEditMode && isFetchingFlightDetails);
  const isSubmitDisabled = isLoading || isAnyPilotInvalidForFlight || !!gliderWarning || !!towPlaneWarning;

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
                        onSelect={(date) => { field.onChange(date); setIsCalendarOpen(false); }}
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
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">{picOrStudentLabel}</FormLabel>
                   <Popover open={picPilotPopoverOpen} onOpenChange={setPicPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={isLoading || (!user?.is_admin && !isInstructionGivenMode)}
                        >
                          {field.value ? getPilotName(field.value) : `Seleccionar ${picOrStudentLabel.toLowerCase()}`}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar piloto..." value={picPilotSearchTerm} onValueChange={setPicPilotSearchTerm}/>
                        <CommandList>
                          {(!sortedPilotsForPic || sortedPilotsForPic.length === 0) && !pilotsLoading && !categoriesLoading ? (
                            <CommandEmpty>No hay pilotos con categoría para vuelo en planeador.</CommandEmpty>
                          ) : (
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                          )}
                          <CommandGroup>
                            {sortedPilotsForPic.map((pilot) => (
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
                  {(!sortedPilotsForPic || sortedPilotsForPic.length === 0) && !pilotsLoading && !categoriesLoading && (
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
              name="flight_purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Propósito del Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isAnyPilotInvalidForFlight || isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar propósito" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GLIDER_FLIGHT_PURPOSES.map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {FLIGHT_PURPOSE_DISPLAY_MAP[purpose as keyof typeof FLIGHT_PURPOSE_DISPLAY_MAP] || purpose}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isInstructionTakenMode && (
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
                              {sortedInstructors.map((pilot) => (
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
                      <Input type="text" placeholder="09:00" {...field} disabled={isAnyPilotInvalidForFlight || isLoading} />
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
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Hora de Llegada (HH:MM)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="10:30" {...field} disabled={isAnyPilotInvalidForFlight || isLoading} />
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
