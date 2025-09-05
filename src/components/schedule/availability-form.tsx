
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
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM)."),
  category_selections: z.record(z.boolean()),
  is_tow_pilot_available: z.boolean().default(false),
  flight_type_id: z.string().default('local'), 
  aircraft_id: z.string().optional().nullable(),
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
  selectedDate: Date;
  existingEntries?: ScheduleEntry[];
}

const normalizeCategoryName = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

const NORMALIZED_REMOLCADOR = "remolcador";
const NORMALIZED_INSTRUCTOR_PLANEADOR = "instructor planeador";
const NORMALIZED_INSTRUCTOR_AVION = "instructor avion";

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
        start_time: '09:00',
        category_selections: {},
        is_tow_pilot_available: false,
        flight_type_id: 'local',
        aircraft_id: null,
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
      
      const initialSelections: Record<string, boolean> = {};
      if (entry) {
        initialSelections[entry.pilot_category_id] = true;
      }

      form.reset({
        date: entry?.date ? parseISO(entry.date) : (selectedDate || new Date()),
        pilot_id: initialPilotId,
        start_time: entry?.start_time?.substring(0,5) || '09:00',
        category_selections: initialSelections,
        is_tow_pilot_available: entry?.is_tow_pilot_available ?? false,
        flight_type_id: entry?.flight_type_id || 'local',
        aircraft_id: entry?.aircraft_id || null,
      });
      setPilotSearchTerm('');
    }
  }, [open, entry, selectedDate, form, currentUserLinkedPilotId, currentUser?.is_admin]);

  const watchedPilotId = form.watch('pilot_id');
  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);

  const handleTimeInputBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    let value = event.target.value.replace(/[^0-9]/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    if (value.length === 3) value = '0' + value;
    if (value.length === 4) {
      const hours = value.substring(0, 2);
      const minutes = value.substring(2, 4);
      if (parseInt(hours, 10) < 24 && parseInt(minutes, 10) < 60) {
        form.setValue('start_time', `${hours}:${minutes}`, { shouldValidate: true });
      }
    }
  };


  useEffect(() => {
    form.setValue('category_selections', {});
    form.setValue('is_tow_pilot_available', false);
  }, [watchedPilotId, form]);

  const watchedCategorySelections = form.watch('category_selections');
  
  const isAnyRemolcadorCategorySelected = useMemo(() => {
    return pilotCategoriesForSelectedPilot.some(cat => {
        const isRemolcador = normalizeCategoryName(cat.name) === NORMALIZED_REMOLCADOR;
        return isRemolcador && watchedCategorySelections[cat.id];
    });
  }, [pilotCategoriesForSelectedPilot, watchedCategorySelections]);


  const handleSubmit = (data: AvailabilityFormData) => {
    let authUserIdToSet: string | null = null;
    if (!entry && currentUser) {
        authUserIdToSet = currentUser.id;
    } else if (entry && entry.auth_user_id) {
        authUserIdToSet = entry.auth_user_id;
    }

    const selectedCategoryIds = Object.entries(data.category_selections)
      .filter(([, isSelected]) => isSelected)
      .map(([catId]) => catId);

    const entriesToSubmit: Omit<ScheduleEntry, 'id' | 'created_at'>[] = selectedCategoryIds.map(catId => {
      const categoryDetails = categories.find(c => c.id === catId);
      const isRemolcador = normalizeCategoryName(categoryDetails?.name) === NORMALIZED_REMOLCADOR;

      return {
          date: format(data.date, 'yyyy-MM-dd'),
          pilot_id: data.pilot_id,
          pilot_category_id: catId,
          start_time: data.start_time,
          flight_type_id: 'local', // Hardcoded
          aircraft_id: null, // Hardcoded
          is_tow_pilot_available: isRemolcador,
          auth_user_id: authUserIdToSet
      };
    });

    onSubmit(entriesToSubmit, entry?.id);
    onOpenChange(false);
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

  const disablePilotSelection = !entry && !!currentUserLinkedPilotId && !currentUser?.is_admin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Turno' : 'Agregar Disponibilidad'}</DialogTitle>
          <DialogDescription>
            {entry ? 'Modifica los detalles del turno.' : 'Ingresa los detalles del nuevo turno.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={(date) => { if(date) field.onChange(date); setIsCalendarOpen(false); }} initialFocus locale={es} />
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
                  <FormLabel>Piloto</FormLabel>
                  <Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={disablePilotSelection}>
                          {field.value && pilots.find(p => p.id === field.value) ? `${pilots.find(p => p.id === field.value)?.last_name}, ${pilots.find(p => p.id === field.value)?.first_name}` : "Seleccionar piloto"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    {!disablePilotSelection && (
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm} />
                          <CommandList>
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                            <CommandGroup>
                              {sortedAndFilteredPilots.map((pilot) => (
                                <CommandItem value={`${pilot.last_name}, ${pilot.first_name}`} key={pilot.id} onSelect={() => { form.setValue("pilot_id", pilot.id); setPilotPopoverOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")} />
                                  {pilot.last_name}, {pilot.first_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    )}
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disponible desde (HH:MM)</FormLabel>
                  <FormControl>
                    <Input 
                      type="text" 
                      placeholder="09:00" 
                      {...field} 
                      onBlur={handleTimeInputBlur}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Use formato 24hs (ej: 0900 o 1430).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedPilotId && pilotCategoriesForSelectedPilot.length > 0 && (
                <FormField
                    control={form.control}
                    name="category_selections"
                    render={() => (
                        <FormItem>
                            <FormLabel>Disponibilidad por Categoría</FormLabel>
                            <FormDescription>
                                Marca las categorías en las que estarás disponible para esta fecha.
                            </FormDescription>
                             {pilotCategoriesForSelectedPilot.map(cat => (
                                <FormField
                                    key={cat.id}
                                    control={form.control}
                                    name={`category_selections.${cat.id}`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 mt-2">
                                            <FormControl>
                                                <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={!!entry && entry.pilot_category_id !== cat.id}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="font-normal">{cat.name}</FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            ))}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">{entry ? 'Guardar Cambios' : 'Agregar Turno'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
