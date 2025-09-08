
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  start_time: z.string().default('00:00'),
  flight_type_id: z.string().default('local'),
  category_selections: z.record(z.boolean()).optional(),
  aircraft_selections: z.record(z.boolean()).optional(),
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
      start_time: '00:00',
      flight_type_id: 'local',
      category_selections: {},
      aircraft_selections: {},
    },
  });

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
      
      form.reset({
        date: entry ? parseISO(entry.date) : (selectedDate || new Date()),
        pilot_id: initialPilotId,
        start_time: entry?.start_time || '00:00',
        flight_type_id: entry?.flight_type_id || 'local',
        category_selections: entry ? { [entry.pilot_category_id]: true } : {},
        aircraft_selections: entry?.aircraft_id ? { [entry.aircraft_id]: true } : {},
      });
    }
  }, [open, entry, selectedDate, form, currentUserLinkedPilotId, currentUser?.is_admin]);

  const watchedPilotId = form.watch('pilot_id');
  const watchedCategorySelections = form.watch('category_selections');
  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);

  const availableAircraftForSelection = useMemo(() => {
    if (!watchedCategorySelections || Object.keys(watchedCategorySelections).filter(k => watchedCategorySelections[k]).length === 0) {
      return [];
    }

    const selectedCategoryIds = Object.keys(watchedCategorySelections).filter(id => watchedCategorySelections[id]);
    const aircraftTypesToShow = new Set<string>();

    selectedCategoryIds.forEach(catId => {
        const category = categories.find(c => c.id === catId);
        const normalizedCatName = normalizeCategoryName(category?.name);
        
        if (normalizedCatName.includes('planeador')) {
            aircraftTypesToShow.add('Glider');
        }
        if (normalizedCatName.includes('avion')) {
            aircraftTypesToShow.add('Avión');
        }
        if (normalizedCatName.includes('remolcador')) {
            aircraftTypesToShow.add('Tow Plane');
        }
    });

    return aircraft.filter(ac => aircraftTypesToShow.has(ac.type));
  }, [watchedCategorySelections, categories, aircraft]);

  const handleSubmit = (data: AvailabilityFormData) => {
    if (!currentUser) return;
  
    const selectedCategoryIds = Object.keys(data.category_selections || {}).filter(id => data.category_selections?.[id]);
    const selectedAircraftIds = Object.keys(data.aircraft_selections || {}).filter(id => data.aircraft_selections?.[id]);
  
    const entriesToCreate: Omit<ScheduleEntry, 'id' | 'created_at'>[] = [];
  
    selectedCategoryIds.forEach(categoryId => {
      const categoryDetails = categories.find(c => c.id === categoryId);
      const isRemolcadorCategory = normalizeCategoryName(categoryDetails?.name) === NORMALIZED_REMOLCADOR;
      const isTowPilotAvailable = isRemolcadorCategory ? data.category_selections?.[`${categoryId}-tow-available`] : false;
      
      const relevantAircraftIds = selectedAircraftIds.length > 0 
        ? selectedAircraftIds 
        : [null]; 
  
      relevantAircraftIds.forEach(aircraftId => {
        const entry: Omit<ScheduleEntry, 'id' | 'created_at'> = {
          date: format(data.date, 'yyyy-MM-dd'),
          pilot_id: data.pilot_id,
          pilot_category_id: categoryId,
          is_tow_pilot_available: isTowPilotAvailable,
          start_time: data.start_time,
          flight_type_id: data.flight_type_id,
          aircraft_id: aircraftId,
          auth_user_id: entry?.auth_user_id || currentUser.id,
        };
        entriesToCreate.push(entry);
      });
    });
  
    onSubmit(entriesToCreate, entry?.id);
    onOpenChange(false);
  };
  

  const disablePilotSelection = !entry && !!currentUserLinkedPilotId && !currentUser?.is_admin;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Turno' : 'Agregar Disponibilidad'}</DialogTitle>
          <DialogDescription>
            Selecciona el piloto, sus categorías y aeronaves disponibles. Se creará un turno por cada combinación.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            <FormField control={form.control} name="date" render={({ field }) => (
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
            )}/>
             <FormField
                control={form.control}
                name="pilot_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Piloto</FormLabel>
                        <Select onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue('category_selections', {});
                            form.setValue('aircraft_selections', {});
                        }} value={field.value} disabled={disablePilotSelection}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar piloto" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {pilots.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.last_name}, {p.first_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
              />

            {pilotDetails && pilotCategoriesForSelectedPilot.length > 0 && (
              <FormItem>
                <FormLabel>Categorías para este Turno</FormLabel>
                <div className="space-y-2 rounded-md border p-4">
                  {pilotCategoriesForSelectedPilot.map((category) => (
                    <FormField
                      key={category.id}
                      control={form.control}
                      name={`category_selections.${category.id}`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center space-x-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{category.name}</FormLabel>
                          </div>
                          {normalizeCategoryName(category.name) === NORMALIZED_REMOLCADOR && field.value && (
                             <FormField
                                control={form.control}
                                name={`category_selections.${category.id}-tow-available`}
                                render={({ field: subField }) => (
                                  <FormItem className="flex items-center space-x-3 pl-6 pt-2">
                                    <FormControl>
                                      <Checkbox
                                        checked={subField.value}
                                        onCheckedChange={subField.onChange}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-xs font-normal text-muted-foreground">¿Disponible para remolcar?</FormLabel>
                                  </FormItem>
                                )}
                              />
                          )}
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}

            {availableAircraftForSelection.length > 0 && (
                 <FormItem>
                    <FormLabel>Asignación de Aeronaves (Opcional)</FormLabel>
                    <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                      {availableAircraftForSelection.map((ac) => {
                        const today = startOfDay(new Date());
                        const isInsuranceExpired = ac.insurance_expiry_date ? isBefore(parseISO(ac.insurance_expiry_date), today) : false;
                        const isAnnualExpired = ac.annual_review_date ? isBefore(parseISO(ac.annual_review_date), today) : false;
                        const isEffectivelyOutOfService = ac.is_out_of_service || isInsuranceExpired || isAnnualExpired;

                        return (
                          <FormField
                            key={ac.id}
                            control={form.control}
                            name={`aircraft_selections.${ac.id}`}
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-3">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isEffectivelyOutOfService}
                                  />
                                </FormControl>
                                <FormLabel className={cn("font-normal", isEffectivelyOutOfService && "text-muted-foreground line-through")}>
                                    {ac.name}
                                    {isEffectivelyOutOfService && <span className="text-xs"> (Fuera de servicio)</span>}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        )
                      })}
                    </div>
                 </FormItem>
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
