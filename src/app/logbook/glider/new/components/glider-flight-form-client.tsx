
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; 
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, isValid, differenceInMinutes, startOfDay, parse, isBefore, differenceInDays, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CompletedGliderFlight, Pilot, Aircraft, ScheduleEntry, PilotCategory, GliderFlightPurpose } from '@/types'; 
import { GLIDER_FLIGHT_PURPOSES } from '@/types';
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

const gliderFlightSchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  instructor_id: z.string().optional().nullable(),
  tow_pilot_id: z.string().min(1, "Seleccione un piloto remolcador."),
  glider_aircraft_id: z.string().min(1, "Seleccione un planeador."),
  tow_aircraft_id: z.string().min(1, "Seleccione un avión remolcador."),
  flight_purpose: z.enum(GLIDER_FLIGHT_PURPOSES, { required_error: "El propósito del vuelo es obligatorio." }),
  departure_time: z.string().regex(/^([01]\\d|2[0-3]):([0-5]\\d)$/, "Formato de hora de salida inválido (HH:MM)."),
  arrival_time: z.string().regex(/^([01]\\d|2[0-3]):([0-5]\\d)$/, "Formato de hora de llegada inválido (HH:MM)."),
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
  const { aircraft, loading: aircraftLoading, fetchAircraft, getAircraftName: getAircraftFullName } = useAircraftStore();
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
  const [calculatedDuration, setCalculatedDuration] = useState<string | null>(null);

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
          const { data, error } = await supabase
            .from('completed_glider_flights')
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
                form.reset({
                    ...data,
                    date: data.date ? parseISO(data.date) : new Date(),
                    instructor_id: data.instructor_id || null,
                    notes: data.notes || null,
                    schedule_entry_id: data.schedule_entry_id || null,
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
    } else if (scheduleEntryIdParam && scheduleEntries.length > 0 && pilots.length > 0 && aircraft.length > 0) {
        const entry = scheduleEntries.find(e => e.id === scheduleEntryIdParam);
        if (entry) {
            form.reset({
            date: entry.date ? parseISO(entry.date) : new Date(),
            pilot_id: entry.pilot_id || '',
            glider_aircraft_id: entry.aircraft_id || '',
            departure_time: entry.start_time ? entry.start_time.substring(0,5) : '',
            schedule_entry_id: entry.id,
            instructor_id: null,
            tow_pilot_id: '',
            tow_aircraft_id: '',
            flight_purpose: entry.flight_type_id && GLIDER_FLIGHT_PURPOSES.includes(entry.flight_type_id as GliderFlightPurpose) ? entry.flight_type_id as GliderFlightPurpose : undefined,
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
  }, [isEditMode, flightIdToLoad, scheduleEntryIdParam, form, pilots, user, aircraft, scheduleEntries]);


  const watchedPicPilotId = form.watch("pilot_id");
  const watchedInstructorId = form.watch("instructor_id");
  const watchedDate = form.watch("date");
  const watchedDepartureTime = form.watch('departure_time');
  const watchedArrivalTime = form.watch('arrival_time');
  const watchedFlightPurpose = form.watch('flight_purpose');

  const showInstructorField = useMemo(() => {
    return watchedFlightPurpose === 'instrucción' || watchedFlightPurpose === 'readaptación';
  }, [watchedFlightPurpose]);

  useEffect(() => {
    if (!showInstructorField && form.getValues("instructor_id") !== null) {
      form.setValue("instructor_id", null, { shouldValidate: true });
      setInstructorSearchTerm(''); 
    }
  }, [showInstructorField, form]);


  useEffect(() => {
    if (watchedDepartureTime && watchedArrivalTime && watchedDate && /^\d{2}:\d{2}$/.test(watchedDepartureTime) && /^\d{2}:\d{2}$/.test(watchedArrivalTime)) {
      const [depH, depM] = watchedDepartureTime.split(':').map(Number);
      const [arrH, arrM] = watchedArrivalTime.split(':').map(Number);

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
    setMedicalWarning(null);
    if (watchedPicPilotId && watchedDate && pilots.length > 0) {
      const pilot = pilots.find(p => p.id === watchedPicPilotId);
      if (pilot?.medical_expiry) {
        const medicalExpiryDate = parseISO(pilot.medical_expiry);
        const flightDate = startOfDay(watchedDate);
        if (isValid(medicalExpiryDate)) {
          if (isBefore(medicalExpiryDate, flightDate)) {
            setMedicalWarning(`¡Psicofísico VENCIDO el ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })}! No puede registrar vuelos.`);
          } else {
            const daysDiff = differenceInDays(medicalExpiryDate, flightDate);
            if (daysDiff <= 30) {
              setMedicalWarning(`Psicofísico vence pronto: ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })} (en ${daysDiff} días).`);
            }
          }
        }
      }
    }
  }, [watchedPicPilotId, watchedDate, pilots]);


  const sortedPilots = useMemo(() => {
    return [...pilots].sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots]);

  const instructorCategoryId = useMemo(() => {
    return categories.find(cat => cat.name.trim().toLowerCase() === 'instructor')?.id;
  }, [categories]);

  const towPilotCategoryId = useMemo(() => {
    return categories.find(cat => cat.name.trim().toLowerCase() === 'remolcador')?.id;
  }, [categories]);

  const sortedInstructors = useMemo(() => {
    if (!instructorCategoryId) return [];
    return sortedPilots.filter(pilot =>
      pilot.category_ids.includes(instructorCategoryId) &&
      pilot.id !== watchedPicPilotId
    );
  }, [sortedPilots, instructorCategoryId, watchedPicPilotId]);

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

  const isTimeOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    return start1 < end2 && start2 < end1;
  };

  const isPilotInvalidForFlight = useMemo(() => {
    return !!(medicalWarning && medicalWarning.toUpperCase().includes("VENCIDO"));
  }, [medicalWarning]);

  const onSubmit = async (data: GliderFlightFormData) => {
    if (!user) {
      toast({ title: "Error", description: "Debes estar autenticado para registrar un vuelo.", variant: "destructive" });
      return;
    }
    setIsSubmittingForm(true);

    if (isPilotInvalidForFlight) { 
      toast({
        title: "Error de Psicofísico",
        description: medicalWarning || "El psicofísico del piloto está vencido. No puede registrar vuelos.",
        variant: "destructive",
        duration: 7000,
      });
      setIsSubmittingForm(false);
      return;
    }

    const flightDate = data.date;
    const [depH, depM] = data.departure_time.split(':').map(Number);
    const [arrH, arrM] = data.arrival_time.split(':').map(Number);

    const newFlightStart = setMinutes(setHours(flightDate, depH), depM);
    const newFlightEnd = setMinutes(setHours(flightDate, arrH), arrM);

    if (!isEditMode || !initialFlightData) { 
      await fetchCompletedGliderFlights(); 
    }
    
    const flightsToCheckForConflict = completedGliderFlights.filter(f => isEditMode ? f.id !== flightIdToLoad : true);


    const conflictingPilotFlight = flightsToCheckForConflict.find(existingFlight => {
        if (existingFlight.pilot_id !== data.pilot_id || format(parseISO(existingFlight.date), 'yyyy-MM-dd') !== format(flightDate, 'yyyy-MM-dd')) {
            return false;
        }
        const [exDepH, exDepM] = existingFlight.departure_time.split(':').map(Number);
        const [exArrH, exArrM] = existingFlight.arrival_time.split(':').map(Number);
        const existingStart = setMinutes(setHours(parseISO(existingFlight.date), exDepH), exDepM);
        const existingEnd = setMinutes(setHours(parseISO(existingFlight.date), exArrH), exArrM);
        return isTimeOverlap(newFlightStart, newFlightEnd, existingStart, existingEnd);
    });

    if (conflictingPilotFlight) {
        toast({
            title: "Conflicto de Horario (Piloto)",
            description: `El piloto ${getPilotName(data.pilot_id)} ya tiene un vuelo registrado (${conflictingPilotFlight.departure_time} - ${conflictingPilotFlight.arrival_time}) que se superpone con este horario.`,
            variant: "destructive",
            duration: 7000,
        });
        setIsSubmittingForm(false);
        return;
    }

    const conflictingAircraftFlight = flightsToCheckForConflict.find(existingFlight => {
        if (existingFlight.glider_aircraft_id !== data.glider_aircraft_id || format(parseISO(existingFlight.date), 'yyyy-MM-dd') !== format(flightDate, 'yyyy-MM-dd')) {
            return false;
        }
        const [exDepH, exDepM] = existingFlight.departure_time.split(':').map(Number);
        const [exArrH, exArrM] = existingFlight.arrival_time.split(':').map(Number);
        const existingStart = setMinutes(setHours(parseISO(existingFlight.date), exDepH), exDepM);
        const existingEnd = setMinutes(setHours(parseISO(existingFlight.date), exArrH), exArrM);
        return isTimeOverlap(newFlightStart, newFlightEnd, existingStart, existingEnd);
    });

    if (conflictingAircraftFlight) {
        const aircraftName = getAircraftFullName(data.glider_aircraft_id);
        toast({
            title: "Conflicto de Horario (Aeronave)",
            description: `El planeador ${aircraftName} ya tiene un vuelo registrado (${conflictingAircraftFlight.departure_time} - ${conflictingAircraftFlight.arrival_time}) que se superpone con este horario.`,
            variant: "destructive",
            duration: 7000,
        });
        setIsSubmittingForm(false);
        return;
    }


    const departureDateTime = parse(data.departure_time, 'HH:mm', data.date);
    const arrivalDateTime = parse(data.arrival_time, 'HH:mm', data.date);
    const durationMinutes = differenceInMinutes(arrivalDateTime, departureDateTime);

    let flightDurationDecimal = 0;
    if (durationMinutes > 0) {
        const decimalHours = durationMinutes / 60;
        flightDurationDecimal = parseFloat((Math.ceil(decimalHours * 10) / 10).toFixed(1));
    }

    const submissionData = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'),
      flight_duration_decimal: flightDurationDecimal,
      schedule_entry_id: data.schedule_entry_id || null,
      instructor_id: data.instructor_id || null,
      notes: data.notes || null,
    };

    let result;
    if (isEditMode && flightIdToLoad) {
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
      result = await updateCompletedGliderFlight(flightIdToLoad, updatePayload);
    } else {
      result = await addCompletedGliderFlight({
        ...submissionData,
        logbook_type: 'glider',
        auth_user_id: user.id,
      });
    }

    setIsSubmittingForm(false);

    if (result) {
      toast({ title: `Vuelo en Planeador ${isEditMode ? 'Actualizado' : 'Registrado'}`, description: `El vuelo ha sido ${isEditMode ? 'actualizado' : 'guardado'} exitosamente.` });
      await fetchCompletedGliderFlights(); 
      router.push('/logbook/glider/list');
    } else {
      toast({ title: `Error al ${isEditMode ? 'Actualizar' : 'Registrar'}`, description: `No se pudo ${isEditMode ? 'actualizar' : 'guardar'} el vuelo. Intenta de nuevo.`, variant: "destructive" });
    }
  };

  const isLoading = authLoading || pilotsLoading || aircraftLoading || categoriesLoading || scheduleLoading || submittingAddUpdate || isSubmittingForm || (isEditMode && isFetchingFlightDetails);
  const isSubmitDisabled = isLoading || isPilotInvalidForFlight;
  const areFieldsDisabled = isLoading || isPilotInvalidForFlight;


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
                <Button asChild variant="outline"><Link href="/logbook/glider/list">Volver al listado</Link></Button>
            </CardFooter>
        </Card>
    );
  }


  if (authLoading && !isEditMode) { 
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Detalles del Vuelo en Planeador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </CardFooter>
      </Card>
    );
  }

  if (!user) {
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
                  <FormLabel>Fecha del Vuelo</FormLabel>
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
                  <FormLabel>Piloto a Cargo (PIC)</FormLabel>
                   <Popover open={picPilotPopoverOpen} onOpenChange={setPicPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={isLoading || (isEditMode && initialFlightData?.auth_user_id !== user?.id && !user?.is_admin) }
                        >
                          {field.value ? getPilotName(field.value) : "Seleccionar piloto"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar piloto..." value={picPilotSearchTerm} onValueChange={setPicPilotSearchTerm}/>
                        <CommandList>
                          <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                          <CommandGroup>
                            {sortedPilots.map((pilot) => (
                              <CommandItem
                                value={`${pilot.last_name}, ${pilot.first_name}`}
                                key={pilot.id}
                                onSelect={() => {
                                  form.setValue("pilot_id", pilot.id, { shouldValidate: true });
                                  setPicPilotPopoverOpen(false);
                                }}
                                disabled={(isEditMode && initialFlightData?.auth_user_id !== user?.id && !user?.is_admin) }
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {medicalWarning && (
              <Alert variant={isPilotInvalidForFlight ? "destructive" : "default"} className={!isPilotInvalidForFlight ? "border-yellow-500" : ""}>
                <AlertTriangle className={cn("h-4 w-4", !isPilotInvalidForFlight && "text-yellow-600")} />
                <AlertTitle>{isPilotInvalidForFlight ? "Psicofísico Vencido" : "Advertencia de Psicofísico"}</AlertTitle>
                <AlertDescription>{medicalWarning}</AlertDescription>
              </Alert>
            )}
            
            <FormField
              control={form.control}
              name="flight_purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Propósito del Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={areFieldsDisabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar propósito" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GLIDER_FLIGHT_PURPOSES.map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {purpose.charAt(0).toUpperCase() + purpose.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showInstructorField && (
              <FormField
                control={form.control}
                name="instructor_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Instructor</FormLabel>
                    <Popover open={instructorPopoverOpen} onOpenChange={setInstructorPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                            disabled={areFieldsDisabled || !instructorCategoryId}
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
                            <CommandEmpty>No se encontraron instructores.</CommandEmpty>
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
                    {!instructorCategoryId && !categoriesLoading && <FormDescription className="text-xs text-destructive">No se encontró la categoría "Instructor". Por favor, créela.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}


            <FormField
              control={form.control}
              name="tow_pilot_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Piloto Remolcador</FormLabel>
                   <Popover open={towPilotPopoverOpen} onOpenChange={setTowPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={areFieldsDisabled || !towPilotCategoryId}
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
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="glider_aircraft_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Planeador</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={areFieldsDisabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar planeador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredGliders.map((ac) => (
                        <SelectItem key={ac.id} value={ac.id}>
                          {ac.name}
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
              name="tow_aircraft_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avión Remolcador</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={areFieldsDisabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar avión remolcador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredTowPlanes.map((ac) => (
                        <SelectItem key={ac.id} value={ac.id}>
                          {ac.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="departure_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de Salida (HH:MM)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} disabled={areFieldsDisabled} />
                    </FormControl>
                     <FormDescription className="text-xs">
                      Formato de 24 horas (ej: 09:00 para 9:00 AM).
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
                    <FormLabel>Hora de Llegada (HH:MM)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} disabled={areFieldsDisabled} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Formato de 24 horas (ej: 17:30 para 5:30 PM).
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
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Anotaciones adicionales sobre el vuelo..." {...field} value={field.value ?? ""} disabled={areFieldsDisabled}/>
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

