
"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FLIGHT_TYPES } from '@/types';

const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  category_selections: z.record(z.boolean()).optional(),
  aircraft_selections: z.record(z.boolean()).optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato inválido (HH:MM).").default('00:00'),
  is_tow_pilot_available: z.boolean().default(false),
});

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface AvailabilityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ScheduleEntry, 'id' | 'created_at'>[], entryId?: string) => void;
  entry?: ScheduleEntry;
  pilots: Pilot[];
  categories: PilotCategory[];
  aircraft: Aircraft[];
  selectedDate?: Date;
  existingEntries?: ScheduleEntry[];
}

const normalizeCategoryName = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

const NORMALIZED_REMOLCADOR = "remolcador";

export function AvailabilityForm({
  open,
  onOpenChange,
  onSubmit,
  entry,
  pilots,
  categories,
  aircraft,
  selectedDate,
  existingEntries
}: AvailabilityFormProps) {
  const { user: currentUser } = useAuth();
  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      date: selectedDate || new Date(),
      pilot_id: '',
      category_selections: {},
      aircraft_selections: {},
      start_time: '00:00',
      is_tow_pilot_available: false,
    },
  });

  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && pilots && pilots.length > 0) {
      const userPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      setCurrentUserLinkedPilotId(userPilot?.id || null);
    }
  }, [currentUser, pilots]);

  useEffect(() => {
    if (open) {
      let initialPilotId = '';
      if (!entry && currentUserLinkedPilotId && !currentUser?.is_admin) {
        initialPilotId = currentUserLinkedPilotId;
      } else if (entry) {
        initialPilotId = entry.pilot_id;
      }

      const initialFormValues: Partial<AvailabilityFormData> = entry
        ? {
            date: entry.date ? parseISO(entry.date) : (selectedDate || new Date()),
            pilot_id: initialPilotId,
            category_selections: { [entry.pilot_category_id]: true },
            aircraft_selections: entry.aircraft_id ? { [entry.aircraft_id]: true } : {},
            start_time: entry.start_time || '00:00',
            is_tow_pilot_available: entry.is_tow_pilot_available,
          }
        : {
            date: selectedDate || new Date(),
            pilot_id: initialPilotId,
            category_selections: {},
            aircraft_selections: {},
            start_time: '00:00',
            is_tow_pilot_available: false,
          };
      form.reset(initialFormValues);
      setPilotSearchTerm('');
    }
  }, [open, entry, selectedDate, form, currentUserLinkedPilotId, currentUser?.is_admin, categories]);

  const handleTimeInputBlur = (event: React.FocusEvent<HTMLInputElement>) => {
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
        form.setValue('start_time', formattedTime, { shouldValidate: true });
      }
    } else {
        form.setValue('start_time', '00:00', { shouldValidate: true });
    }
  };

  const watchedPilotId = form.watch('pilot_id');
  const watchedCategorySelections = form.watch('category_selections');

  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);

  const showTowAvailabilityCheckbox = useMemo(() => {
    if (!watchedCategorySelections) return false;
    const selectedCatIds = Object.keys(watchedCategorySelections).filter(id => watchedCategorySelections[id]);
    return selectedCatIds.some(id => {
      const cat = categories.find(c => c.id === id);
      return normalizeCategoryName(cat?.name) === NORMALIZED_REMOLCADOR;
    });
  }, [watchedCategorySelections, categories]);

  useEffect(() => {
    if (!showTowAvailabilityCheckbox && form.getValues('is_tow_pilot_available')) {
      form.setValue('is_tow_pilot_available', false);
    }
  }, [showTowAvailabilityCheckbox, form]);

  const availableAircraftForSelection = useMemo(() => {
    const selectedCatIds = watchedCategorySelections ? Object.keys(watchedCategorySelections).filter(id => watchedCategorySelections[id]) : [];
    if (selectedCatIds.length === 0) return [];

    const relevantAircraftTypes = new Set<string>();
    selectedCatIds.forEach(catId => {
      const cat = categories.find(c => c.id === catId);
      const normalizedName = normalizeCategoryName(cat?.name);
      if (normalizedName.includes('planeador')) relevantAircraftTypes.add('Glider');
      if (normalizedName.includes('avion')) relevantAircraftTypes.add('Avión');
      if (normalizedName.includes('remolcador')) relevantAircraftTypes.add('Tow Plane');
    });

    return aircraft.filter(ac => relevantAircraftTypes.has(ac.type));
  }, [watchedCategorySelections, categories, aircraft]);

  const handleSubmit = (data: AvailabilityFormData) => {
    const isFormInEditMode = !!entry;
    const selectedCategoryIds = data.category_selections ? Object.keys(data.category_selections).filter(id => data.category_selections![id]) : [];
    const selectedAircraftIds = data.aircraft_selections ? Object.keys(data.aircraft_selections).filter(id => data.aircraft_selections![id]) : [];

    let authUserIdToSet: string | null = (entry?.auth_user_id) ?? (currentUser?.id ?? null);
    
    if (isFormInEditMode) { // Editing mode
        const dataToSubmit = {
          ...entry,
          ...data,
          date: format(data.date, 'yyyy-MM-dd'),
          pilot_category_id: selectedCategoryIds[0], // In edit mode, we only allow one category
          aircraft_id: selectedAircraftIds.length > 0 ? selectedAircraftIds[0] : null,
          flight_type_id: entry.flight_type_id,
          auth_user_id: authUserIdToSet,
        };
        onSubmit([dataToSubmit], entry.id);

    } else { // Creating mode
        const entriesToCreate: Omit<ScheduleEntry, 'id' | 'created_at'>[] = [];
        selectedCategoryIds.forEach(catId => {
            const flightTypeId = FLIGHT_TYPES.find(ft => ft.id === 'local')?.id ?? 'local';
            if (selectedAircraftIds.length > 0) {
                selectedAircraftIds.forEach(acId => {
                    entriesToCreate.push({
                        date: format(data.date, 'yyyy-MM-dd'),
                        pilot_id: data.pilot_id,
                        pilot_category_id: catId,
                        is_tow_pilot_available: data.is_tow_pilot_available,
                        start_time: data.start_time,
                        flight_type_id: flightTypeId,
                        aircraft_id: acId,
                        auth_user_id: authUserIdToSet,
                    });
                });
            } else {
                entriesToCreate.push({
                    date: format(data.date, 'yyyy-MM-dd'),
                    pilot_id: data.pilot_id,
                    pilot_category_id: catId,
                    is_tow_pilot_available: data.is_tow_pilot_available,
                    start_time: data.start_time,
                    flight_type_id: flightTypeId,
                    aircraft_id: null,
                    auth_user_id: authUserIdToSet,
                });
            }
        });
        onSubmit(entriesToCreate);
    }
  };

  const sortedAndFilteredPilots = useMemo(() => {
    const searchTermLower = pilotSearchTerm.toLowerCase();
    return pilots
      .filter(p =>
        p.last_name.toLowerCase().includes(searchTermLower) ||
        p.first_name.toLowerCase().includes(searchTermLower)
      )
      .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  }, [pilots, pilotSearchTerm]);

  const disablePilotSelection = !currentUser?.is_admin && !!currentUserLinkedPilotId && !entry;
  const isFormInEditMode = !!entry;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Turno' : 'Agregar Disponibilidad'}</DialogTitle>
          <DialogDescription>
            {entry ? 'Modifica los detalles del turno.' : 'Ingresa los detalles para los nuevos turnos.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Fecha</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild><FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </FormControl></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={(date) => { if(date) field.onChange(date); setIsCalendarOpen(false); }} initialFocus locale={es} />
                    </PopoverContent>
                  </Popover><FormMessage />
                </FormItem>
            )}/>
            <FormField control={form.control} name="pilot_id" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Piloto</FormLabel>
                  <Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}>
                    <PopoverTrigger asChild><FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={disablePilotSelection}>
                          {field.value && pilots.find(p => p.id === field.value) ? `${pilots.find(p => p.id === field.value)?.last_name}, ${pilots.find(p => p.id === field.value)?.first_name}` : "Seleccionar piloto"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </FormControl></PopoverTrigger>
                    {!disablePilotSelection && (
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command><CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm} /><CommandList>
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                            <CommandGroup>{sortedAndFilteredPilots.map((pilot) => (
                                <CommandItem value={`${pilot.last_name}, ${pilot.first_name}`} key={pilot.id} onSelect={() => { form.setValue("pilot_id", pilot.id); setPilotPopoverOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")} />
                                  {pilot.last_name}, {pilot.first_name}
                                </CommandItem>
                            ))}</CommandGroup>
                        </CommandList></Command>
                      </PopoverContent>
                    )}
                  </Popover><FormMessage />
                </FormItem>
            )}/>
            
            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora de Inicio (HHMM)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="0900" 
                      {...field}
                      onBlur={handleTimeInputBlur}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Formato 24hs. Ej: 0900 para 9:00 AM, 1430 para 2:30 PM.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {pilotDetails && (
              <div>
                <FormLabel>Categorías del Piloto</FormLabel>
                <div className="rounded-md border p-2 space-y-1">
                  {pilotCategoriesForSelectedPilot.length > 0 ? pilotCategoriesForSelectedPilot.map(cat => (
                    <FormField key={cat.id} control={form.control} name={`category_selections.${cat.id}`} render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-1 rounded-md hover:bg-accent">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isFormInEditMode && !form.getValues('category_selections')?.[cat.id]} /></FormControl>
                          <FormLabel className="font-normal">{cat.name}</FormLabel>
                        </FormItem>
                    )}/>
                  )) : <p className="text-sm text-muted-foreground p-1">Este piloto no tiene categorías asignadas.</p>}
                </div>
              </div>
            )}

            {showTowAvailabilityCheckbox && (
              <FormField control={form.control} name="is_tow_pilot_available" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2">
                    <div className="space-y-0.5"><FormLabel>¿Disponible como Remolcador?</FormLabel></div>
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
              )}/>
            )}

            {availableAircraftForSelection.length > 0 && (
                 <div>
                    <FormLabel>Asignación de Aeronaves (Opcional)</FormLabel>
                    <div className="rounded-md border p-2 space-y-1">
                    {availableAircraftForSelection.map(ac => {
                        const flightDate = form.getValues('date') || new Date();
                        const isExpiredOnFlightDate = (ac.annual_review_date && isBefore(parseISO(ac.annual_review_date), startOfDay(flightDate))) || 
                                                     (ac.insurance_expiry_date && isBefore(parseISO(ac.insurance_expiry_date), startOfDay(flightDate)));
                        const isOutOfService = ac.is_out_of_service || isExpiredOnFlightDate;

                        return (
                            <FormField key={ac.id} control={form.control} name={`aircraft_selections.${ac.id}`} render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-1 rounded-md hover:bg-accent">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isOutOfService || (isFormInEditMode && !form.getValues('aircraft_selections')?.[ac.id])} /></FormControl>
                                    <FormLabel className={cn("font-normal", isOutOfService && "text-muted-foreground line-through")}>
                                        {ac.name} {isOutOfService && "(Fuera de servicio)"}
                                    </FormLabel>
                                </FormItem>
                            )}/>
                        )
                    })}
                    </div>
                </div>
            )}
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">{entry ? 'Guardar Cambios' : 'Agregar Turno(s)'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
