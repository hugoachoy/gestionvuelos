
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotsStore } from '@/store/data-hooks';

const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  // pilot_category_id will be handled by the checkboxes logic
  categories: z.record(z.object({
    selected: z.boolean(),
    is_tow_pilot_available: z.boolean().optional(),
    is_instructor_available: z.boolean().optional(),
  })).refine(val => Object.values(val).some(cat => cat.selected), {
    message: "Debe seleccionar al menos una categoría."
  })
});

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface AvailabilityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ScheduleEntry, 'id' | 'created_at'>[], entryId?: string) => void;
  entry?: ScheduleEntry;
  pilots: Pilot[];
  categories: PilotCategory[];
  selectedDate?: Date;
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
  selectedDate,
}: AvailabilityFormProps) {
  const { user: currentUser } = useAuth();
  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
        date: selectedDate || new Date(),
        pilot_id: '',
        categories: {},
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
      
      const initialFormValues = {
            date: entry?.date ? parseISO(entry.date) : (selectedDate || new Date()),
            pilot_id: initialPilotId,
            categories: {},
      };
      
      form.reset(initialFormValues);

      if (entry) {
        form.setValue(`categories.${entry.pilot_category_id}.selected`, true);
        if (entry.is_tow_pilot_available) {
            form.setValue(`categories.${entry.pilot_category_id}.is_tow_pilot_available`, true);
        }
        if (entry.is_instructor_available) {
            form.setValue(`categories.${entry.pilot_category_id}.is_instructor_available`, true);
        }
      }

      setPilotSearchTerm('');
    }
  }, [open, entry, selectedDate, form, currentUserLinkedPilotId, currentUser?.is_admin]);

  const watchedPilotId = form.watch('pilot_id');
  const watchedCategories = form.watch('categories');
  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);

  useEffect(() => {
    if (!watchedPilotId) {
        form.setValue('categories', {});
    } else {
        const currentCategories = form.getValues('categories');
        const newCategoriesState: Record<string, any> = {};
        (pilotDetails?.category_ids || []).forEach(catId => {
            newCategoriesState[catId] = currentCategories[catId] || { selected: false, is_tow_pilot_available: false, is_instructor_available: false };
        });
        form.setValue('categories', newCategoriesState);
    }
  }, [watchedPilotId, pilotDetails, form]);


  const handleSubmit = (data: AvailabilityFormData) => {
    let authUserIdToSet: string | null = null;
    if (!entry && currentUser) {
        authUserIdToSet = currentUser.id;
    } else if (entry && entry.auth_user_id) {
        authUserIdToSet = entry.auth_user_id;
    }

    const entriesToSubmit: Omit<ScheduleEntry, 'id' | 'created_at'>[] = [];
    
    for (const categoryId in data.categories) {
        const catData = data.categories[categoryId];
        if (catData.selected) {
            entriesToSubmit.push({
                date: format(data.date, 'yyyy-MM-dd'),
                pilot_id: data.pilot_id,
                pilot_category_id: categoryId,
                is_tow_pilot_available: catData.is_tow_pilot_available ?? false,
                is_instructor_available: catData.is_instructor_available ?? false,
                auth_user_id: authUserIdToSet,
                // Hardcoded values
                start_time: '00:00',
                flight_type_id: 'local',
                aircraft_id: null,
            });
        }
    }
    
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
            {entry ? 'Modifica los detalles del turno.' : 'Selecciona las categorías en las que estarás disponible.'}
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
             {watchedPilotId && (
                <FormField
                  control={form.control}
                  name="categories"
                  render={() => (
                    <FormItem>
                        <div className="mb-4">
                            <FormLabel className="text-base">Categorías Disponibles</FormLabel>
                            <FormDescription>
                                Marca todas las categorías en las que estarás disponible.
                            </FormDescription>
                        </div>
                        {pilotCategoriesForSelectedPilot.length > 0 ? pilotCategoriesForSelectedPilot.map((category) => {
                            const isInstructor = normalizeCategoryName(category.name).includes("instructor");
                            const isRemolcador = normalizeCategoryName(category.name) === NORMALIZED_REMOLCADOR;

                            return (
                                <FormField
                                    key={category.id}
                                    control={form.control}
                                    name={`categories.${category.id}.selected`}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col rounded-lg border p-3 shadow-sm mb-2">
                                            <div className="flex flex-row items-center justify-between">
                                                <FormLabel className="font-normal flex-1" htmlFor={`category-select-${category.id}`}>{category.name}</FormLabel>
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        id={`category-select-${category.id}`}
                                                    />
                                                </FormControl>
                                            </div>
                                            {field.value && isInstructor && (
                                                <FormField
                                                    control={form.control}
                                                    name={`categories.${category.id}.is_instructor_available`}
                                                    render={({ field: subField }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-md border bg-background/50 p-2 mt-2">
                                                            <FormLabel className="text-sm font-normal">¿Disponible como Instructor?</FormLabel>
                                                            <FormControl>
                                                                <Checkbox checked={subField.value} onCheckedChange={subField.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                            {field.value && isRemolcador && (
                                                 <FormField
                                                    control={form.control}
                                                    name={`categories.${category.id}.is_tow_pilot_available`}
                                                    render={({ field: subField }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-md border bg-background/50 p-2 mt-2">
                                                            <FormLabel className="text-sm font-normal">¿Disponible como Remolcador?</FormLabel>
                                                            <FormControl>
                                                                <Checkbox checked={subField.value} onCheckedChange={subField.onChange} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </FormItem>
                                    )}
                                />
                            )
                        }) : <p className="text-sm text-muted-foreground">Este piloto no tiene categorías asignadas.</p>}
                        <FormMessage />
                    </FormItem>
                  )}
                />
             )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={!watchedPilotId || pilotCategoriesForSelectedPilot.length === 0}>{entry ? 'Guardar Cambios' : 'Agregar Turno(s)'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
