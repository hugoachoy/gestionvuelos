
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, isValid, differenceInMinutes, startOfDay, parse, isBefore, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

import type { CompletedEngineFlight, Pilot, Aircraft, ScheduleEntry, PilotCategory } from '@/types';
import { ENGINE_FLIGHT_PURPOSES } from '@/types';
import { usePilotsStore, useAircraftStore, useCompletedEngineFlightsStore, useScheduleStore, usePilotCategoriesStore } from '@/store/data-hooks';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarIcon, Check, ChevronsUpDown, AlertTriangle, Loader2, Save, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

const engineFlightSchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  instructor_id: z.string().optional().nullable(),
  engine_aircraft_id: z.string().min(1, "Seleccione una aeronave."),
  flight_purpose: z.enum(ENGINE_FLIGHT_PURPOSES, { required_error: "El propósito del vuelo es obligatorio." }),
  departure_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de salida inválido (HH:MM)."),
  arrival_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora de llegada inválido (HH:MM)."),
  route_from_to: z.string().optional().nullable(),
  landings_count: z.coerce.number().int().min(0, "Debe ser 0 o más.").optional().nullable(),
  tows_count: z.coerce.number().int().min(0, "Debe ser 0 o más.").optional().nullable(),
  oil_added_liters: z.coerce.number().min(0, "Debe ser 0 o más.").optional().nullable(),
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
});

type EngineFlightFormData = z.infer<typeof engineFlightSchema>;

// Helper function to normalize text (lowercase and remove accents)
const normalizeText = (text?: string | null): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD") // Normalizes to decomposed form (letter + diacritic)
    .replace(/[\u0300-\u036f]/g, ""); // Removes diacritics
};

const ENGINE_FLIGHT_REQUIRED_CATEGORY_KEYWORDS = ["piloto de avion", "remolcador"]; // Already normalized

export function EngineFlightFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const { pilots, loading: pilotsLoading, fetchPilots, getPilotName } = usePilotsStore();
  const { aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { categories, loading: categoriesLoading, fetchCategories: fetchPilotCategories } = usePilotCategoriesStore();
  const { scheduleEntries, loading: scheduleLoading, fetchScheduleEntries } = useScheduleStore();
  const { addCompletedEngineFlight, loading: submitting } = useCompletedEngineFlightsStore();

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [instructorSearchTerm, setInstructorSearchTerm] = useState('');
  const [instructorPopoverOpen, setInstructorPopoverOpen] = useState(false);
  const [medicalWarning, setMedicalWarning] = useState<string | null>(null);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [calculatedDuration, setCalculatedDuration] = useState<string | null>(null);

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
      landings_count: 0,
      tows_count: 0,
      oil_added_liters: null,
      fuel_added_liters: null,
      notes: null,
      schedule_entry_id: null,
    },
  });

  const scheduleEntryIdParam = searchParams.get('schedule_id');

  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchPilotCategories();
    if (scheduleEntryIdParam) {
        const dateParam = searchParams.get('date');
        if (dateParam) fetchScheduleEntries(dateParam);
    }
  }, [fetchPilots, fetchAircraft, fetchPilotCategories, scheduleEntryIdParam, searchParams, fetchScheduleEntries]);

  useEffect(() => {
    if (scheduleEntryIdParam && scheduleEntries.length > 0 && pilots.length > 0 && aircraft.length > 0) {
      const entry = scheduleEntries.find(e => e.id === scheduleEntryIdParam);
      if (entry) {
        form.reset({
          date: entry.date ? parseISO(entry.date) : new Date(),
          pilot_id: entry.pilot_id || '',
          engine_aircraft_id: entry.aircraft_id || '',
          departure_time: entry.start_time ? entry.start_time.substring(0,5) : '',
          schedule_entry_id: entry.id,
          instructor_id: null,
          flight_purpose: undefined,
          arrival_time: '',
          route_from_to: null,
          landings_count: 0,
          tows_count: 0,
          oil_added_liters: null,
          fuel_added_liters: null,
          notes: null,
        });
      }
    } else if (!scheduleEntryIdParam && pilots.length > 0 && aircraft.length > 0) {
        form.reset({
            date: new Date(),
            pilot_id: pilots.find(p => p.auth_user_id === user?.id)?.id || '',
            instructor_id: null,
            engine_aircraft_id: '',
            flight_purpose: undefined,
            departure_time: '',
            arrival_time: '',
            route_from_to: null,
            landings_count: 0,
            tows_count: 0,
            oil_added_liters: null,
            fuel_added_liters: null,
            notes: null,
            schedule_entry_id: null,
        });
    }
  }, [scheduleEntryIdParam, scheduleEntries, form, pilots, user, aircraft]);

  const watchedPilotId = form.watch("pilot_id");
  const watchedDate = form.watch("date");
  const watchedDepartureTime = form.watch('departure_time');
  const watchedArrivalTime = form.watch('arrival_time');


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

  const checkPilotValidity = useCallback(() => {
    setMedicalWarning(null);
    setCategoryWarning(null);

    if (!watchedPilotId || !watchedDate || pilots.length === 0 || categories.length === 0) {
      return;
    }

    const pilot = pilots.find(p => p.id === watchedPilotId);
    if (!pilot) return;

    // Medical Check
    if (pilot.medical_expiry) {
      const medicalExpiryDate = parseISO(pilot.medical_expiry);
      const flightDate = startOfDay(watchedDate);
      if (isValid(medicalExpiryDate)) {
        if (isBefore(medicalExpiryDate, flightDate)) {
          setMedicalWarning(`¡Psicofísico VENCIDO el ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })}! No se puede registrar el vuelo.`);
        } else {
          const daysDiff = differenceInDays(medicalExpiryDate, flightDate);
          if (daysDiff <= 30) {
            setMedicalWarning(`Psicofísico vence pronto: ${format(medicalExpiryDate, "dd/MM/yyyy", { locale: es })} (en ${daysDiff} días).`);
          }
        }
      }
    }

    // Category Check
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
      setCategoryWarning("El piloto no tiene la categoría requerida (Piloto de Avión o Remolcador) para registrar este vuelo.");
    }
  }, [watchedPilotId, watchedDate, pilots, categories]);

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
    return [...pilots]
      .filter(pilot => pilot.category_ids.some(catId => enginePilotCategoryIds.includes(catId)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotsLoading, enginePilotCategoryIds]);


  const instructorCategoryId = useMemo(() => {
    return categories.find(cat => normalizeText(cat.name) === 'instructor')?.id;
  }, [categories]);

  const sortedInstructors = useMemo(() => {
    if (!instructorCategoryId || pilotsLoading || !pilots.length) return [];
    return pilots.filter(pilot =>
      pilot.category_ids.includes(instructorCategoryId) &&
      pilot.id !== watchedPilotId
    ).sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotsLoading, instructorCategoryId, watchedPilotId]);


  const filteredEngineAircraft = useMemo(() => {
    return aircraft.filter(ac => ac.type === 'Tow Plane' || ac.type === 'Avión')
                   .sort((a,b) => a.name.localeCompare(b.name));
  }, [aircraft]);

  const onSubmit = async (data: EngineFlightFormData) => {
    if (!user) {
      toast({ title: "Error", description: "Debes estar autenticado para registrar un vuelo.", variant: "destructive" });
      return;
    }
    setIsSubmittingForm(true);
    // Re-check validity on submit, as state updates might be async
    checkPilotValidity(); 
    // A brief delay to allow state updates from checkPilotValidity to reflect, if any.
    await new Promise(resolve => setTimeout(resolve, 100));


    if (medicalWarning && medicalWarning.includes("VENCIDO!")) {
      toast({
        title: "Error de Psicofísico",
        description: medicalWarning,
        variant: "destructive",
        duration: 7000,
      });
      setIsSubmittingForm(false);
      return;
    }

    if (categoryWarning) {
       toast({
        title: "Error de Categoría",
        description: categoryWarning,
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

    let billableMins: number | null = null;
    if (data.flight_purpose !== 'Remolque planeador' && durationMinutes > 0) {
      billableMins = durationMinutes;
    }


    const submissionData: Omit<CompletedEngineFlight, 'id' | 'created_at'> = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'),
      flight_duration_decimal: flightDurationDecimal,
      billable_minutes: billableMins,
      logbook_type: 'engine',
      auth_user_id: user.id,
      schedule_entry_id: data.schedule_entry_id || null,
      instructor_id: data.instructor_id || null,
      route_from_to: data.route_from_to || null,
      landings_count: data.landings_count || 0,
      tows_count: data.tows_count || 0,
      oil_added_liters: data.oil_added_liters || null,
      fuel_added_liters: data.fuel_added_liters || null,
      notes: data.notes || null,
    };

    const result = await addCompletedEngineFlight(submissionData);
    setIsSubmittingForm(false);

    if (result) {
      toast({ title: "Vuelo a Motor Registrado", description: "El vuelo ha sido guardado exitosamente." });
      router.push('/logbook/engine/list');
    } else {
      toast({ title: "Error al Registrar", description: "No se pudo guardar el vuelo. Intenta de nuevo.", variant: "destructive" });
    }
  };

  const isLoading = authLoading || pilotsLoading || aircraftLoading || categoriesLoading || scheduleLoading || submitting || isSubmittingForm;
  const isSubmitDisabled = isLoading || (medicalWarning != null && medicalWarning.includes("VENCIDO!")) || (categoryWarning != null);


  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Detalles del Vuelo a Motor</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {medicalWarning && (
              <Alert variant={medicalWarning.includes("VENCIDO!") ? "destructive" : "default"} className={!medicalWarning.includes("VENCIDO!") ? "border-yellow-500" : ""}>
                <AlertTriangle className={cn("h-4 w-4", !medicalWarning.includes("VENCIDO!") && "text-yellow-600")} />
                <AlertTitle>{medicalWarning.includes("VENCIDO!") ? "Psicofísico Vencido" : "Advertencia de Psicofísico"}</AlertTitle>
                <AlertDescription>{medicalWarning}</AlertDescription>
              </Alert>
            )}
            {categoryWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Categoría No Válida</AlertTitle>
                <AlertDescription>{categoryWarning}</AlertDescription>
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
              name="pilot_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Piloto a Cargo (PIC)</FormLabel>
                  <Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={isLoading || !sortedPilotsForEngineFlights || sortedPilotsForEngineFlights.length === 0}
                        >
                          {field.value ? getPilotName(field.value) : "Seleccionar piloto"}
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
                                  // checkPilotValidity is called via useEffect on watchedPilotId change
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

            <FormField
              control={form.control}
              name="instructor_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Instructor (Opcional)</FormLabel>
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
                                <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")} />
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

            <FormField
              control={form.control}
              name="engine_aircraft_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aeronave de Motor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar aeronave de motor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredEngineAircraft.map((ac) => (
                        <SelectItem key={ac.id} value={ac.id}>
                          {ac.name} ({ac.type})
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
                      {ENGINE_FLIGHT_PURPOSES.map((purpose) => (
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
                      Formato de 24 horas (ej: 14:30 para 2:30 PM).
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
                      Formato de 24 horas (ej: 15:00 para 3:00 PM).
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
                    <FormLabel>Ruta (Desde - Hasta) (Opcional)</FormLabel>
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
                        <FormLabel>Aterrizajes (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" min="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading} />
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
                        <FormLabel>Remolques Realizados (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" min="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading} />
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
                        <FormLabel>Nafta Cargada (Lts) (Opcional)</FormLabel>
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
                        <FormLabel>Aceite Cargado (Lts) (Opcional)</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={isLoading} />
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
                  <FormLabel>Notas (Opcional)</FormLabel>
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
              Guardar Vuelo a Motor
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
