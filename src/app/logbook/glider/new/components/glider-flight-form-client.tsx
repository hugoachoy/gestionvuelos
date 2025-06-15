
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // Added Link
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, isValid, differenceInMinutes, startOfDay, parse, isBefore, differenceInDays, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CompletedGliderFlight, Pilot, Aircraft, ScheduleEntry, PilotCategory } from '@/types';
import { GLIDER_FLIGHT_PURPOSES } from '@/types';
import { usePilotsStore, useAircraftStore, useCompletedGliderFlightsStore, useScheduleStore, usePilotCategoriesStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert related imports
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton
import { CalendarIcon, Check, ChevronsUpDown, AlertTriangle, Loader2, Save, Clock, XCircle } from 'lucide-react'; // Added AlertTriangle, XCircle
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
});


type GliderFlightFormData = z.infer<typeof gliderFlightSchema>;

export function GliderFlightFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { pilots, loading: pilotsLoading, fetchPilots, getPilotName } = usePilotsStore();
  const { aircraft, loading: aircraftLoading, fetchAircraft, getAircraftName: getAircraftFullName } = useAircraftStore();
  const { categories, loading: categoriesLoading, fetchCategories: fetchPilotCategories } = usePilotCategoriesStore();
  const { scheduleEntries, loading: scheduleLoading , fetchScheduleEntries } = useScheduleStore();
  const { addCompletedGliderFlight, loading: submittingAdd, completedGliderFlights, fetchCompletedGliderFlights } = useCompletedGliderFlightsStore();

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
    fetchCompletedGliderFlights();
    if (scheduleEntryIdParam) {
      const dateParam = searchParams.get('date');
      if (dateParam) {
        fetchScheduleEntries(dateParam);
      }
    }
  }, [fetchPilots, fetchAircraft, fetchPilotCategories, fetchCompletedGliderFlights, scheduleEntryIdParam, searchParams, fetchScheduleEntries]);


  useEffect(() => {
    if (scheduleEntryIdParam && scheduleEntries.length > 0 && pilots.length > 0 && aircraft.length > 0) {
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
    } else if (!scheduleEntryIdParam && pilots.length > 0 && aircraft.length > 0 && user) {
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
  }, [scheduleEntryIdParam, scheduleEntries, form, pilots, user, aircraft]);

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
      setInstructorSearchTerm(''); // Clear search term if instructor field is hidden
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
            setMedicalWarning(`¡Psicofísico VENCIDO el ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })}!`);
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

  const onSubmit = async (data: GliderFlightFormData) => {
    if (!user) {
      toast({ title: "Error", description: "Debes estar autenticado para registrar un vuelo.", variant: "destructive" });
      return;
    }
    setIsSubmittingForm(true);

    if (medicalWarning && medicalWarning.toUpperCase().includes("VENCIDO")) {
      toast({
        title: "Error de Psicofísico",
        description: medicalWarning,
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

    // Client-side conflict check
    const conflictingPilotFlight = completedGliderFlights.find(existingFlight => {
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

    const conflictingAircraftFlight = completedGliderFlights.find(existingFlight => {
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

    const submissionData: Omit<CompletedGliderFlight, 'id' | 'created_at'> = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'),
      flight_duration_decimal: flightDurationDecimal,
      logbook_type: 'glider',
      auth_user_id: user.id,
      schedule_entry_id: data.schedule_entry_id || null,
      instructor_id: data.instructor_id || null,
      tow_pilot_id: data.tow_pilot_id,
      tow_aircraft_id: data.tow_aircraft_id,
      notes: data.notes || null,
    };

    const result = await addCompletedGliderFlight(submissionData);

    if (result) {
      toast({ title: "Vuelo en Planeador Registrado", description: "El vuelo ha sido guardado exitosamente." });
      await fetchCompletedGliderFlights();
      router.push('/logbook/glider/list');
    } else {
      toast({ title: "Error al Registrar", description: "No se pudo guardar el vuelo. Intenta de nuevo.", variant: "destructive" });
    }
    setIsSubmittingForm(false);
  };

  const isLoading = authLoading || pilotsLoading || aircraftLoading || categoriesLoading || scheduleLoading || submittingAdd || isSubmittingForm;
  const isSubmitDisabled = isLoading || (medicalWarning != null && medicalWarning.toUpperCase().includes("VENCIDO"));

  if (authLoading) {
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
          <CardTitle>Detalles del Vuelo en Planeador</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Autenticación Requerida</AlertTitle>
            <AlertDescription>
              Debes iniciar sesión para registrar un nuevo vuelo.
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
        <CardTitle>Detalles del Vuelo en Planeador</CardTitle>
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
                          disabled={isLoading}
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
            
            <FormField
              control={form.control}
              name="flight_purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Propósito del Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
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
                            disabled={isLoading || !instructorCategoryId}
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
                          disabled={isLoading || !towPilotCategoryId}
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
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
                  <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isLoading}>
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
                      <Input type="time" {...field} disabled={isLoading} />
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
                      <Input type="time" {...field} disabled={isLoading} />
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
                    <Textarea placeholder="Anotaciones adicionales sobre el vuelo..." {...field} value={field.value ?? ""} disabled={isLoading}/>
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
              Guardar Vuelo
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

