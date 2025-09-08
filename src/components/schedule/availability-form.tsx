
"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
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
import { FLIGHT_TYPES } from '@/types';

// Schema now handles multiple selections via arrays of objects
const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM)."),
  category_selections: z.array(z.object({
    categoryId: z.string(),
    aircraftIds: z.array(z.string()),
  })).min(1, "Debe seleccionar al menos una categoría.")
   .refine(selections => selections.every(sel => sel.aircraftIds.length > 0), {
    message: "Debe seleccionar al menos una aeronave para cada categoría marcada."
  }),
});


export type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface AvailabilityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ScheduleEntry, 'id' | 'created_at'>[], entryId?: string) => void; // Can now submit multiple entries
  entry?: ScheduleEntry;
  pilots: Pilot[];
  categories: PilotCategory[];
  aircraft: Aircraft[];
  selectedDate: Date;
}

const normalizeCategoryName = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

export function AvailabilityForm({
  open,
  onOpenChange,
  onSubmit,
  entry,
  pilots,
  categories,
  aircraft,
  selectedDate,
}: AvailabilityFormProps) {
  const { user: currentUser } = useAuth();
  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      date: selectedDate,
      pilot_id: '',
      start_time: '09:00',
      category_selections: [],
    },
  });

  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && pilots.length > 0) {
      const userPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      setCurrentUserLinkedPilotId(userPilot?.id || null);
    }
  }, [currentUser, pilots]);

  useEffect(() => {
    if (open) {
      const initialValues = entry
        ? {
            date: parseISO(entry.date),
            pilot_id: entry.pilot_id,
            start_time: entry.start_time.substring(0, 5),
            category_selections: [{
              categoryId: entry.pilot_category_id,
              aircraftIds: entry.aircraft_id ? [entry.aircraft_id] : [],
            }],
          }
        : {
            date: selectedDate,
            pilot_id: !currentUser?.is_admin ? currentUserLinkedPilotId || '' : '',
            start_time: '09:00',
            category_selections: [],
          };
      form.reset(initialValues);
    }
  }, [open, entry, selectedDate, currentUser, currentUserLinkedPilotId, form]);

  const watchedPilotId = form.watch('pilot_id');
  const watchedCategorySelections = form.watch('category_selections');

  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);

  // Reset selections when pilot changes
  useEffect(() => {
    form.setValue('category_selections', []);
  }, [watchedPilotId, form]);

  const handleSubmit = (data: AvailabilityFormData) => {
    const entriesToCreate: Omit<ScheduleEntry, 'id' | 'created_at'>[] = [];
    
    data.category_selections.forEach(selection => {
      selection.aircraftIds.forEach(aircraftId => {
        
        const selectedCategory = categories.find(c => c.id === selection.categoryId);
        const normalizedCategoryName = normalizeCategoryName(selectedCategory?.name);
        let flightTypeId: string = 'local';
        if (normalizedCategoryName.includes('instructor')) {
            flightTypeId = 'instruction_given';
        } else if (normalizedCategoryName.includes('remolcador')) {
            flightTypeId = 'towage';
        }

        entriesToCreate.push({
          date: format(data.date, 'yyyy-MM-dd'),
          start_time: data.start_time,
          pilot_id: data.pilot_id,
          pilot_category_id: selection.categoryId,
          aircraft_id: aircraftId,
          flight_type_id: flightTypeId, 
          auth_user_id: entry?.auth_user_id || currentUser?.id || null,
        });
      });
    });
    
    onSubmit(entriesToCreate, entry?.id);
    onOpenChange(false);
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Turno' : 'Agregar Disponibilidad'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            <FormField control={form.control} name="pilot_id" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Piloto</FormLabel><Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}><PopoverTrigger asChild><FormControl>
                    <Button variant="outline" role="combobox" disabled={!currentUser?.is_admin && !!currentUserLinkedPilotId} className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>{field.value ? `${pilots.find(p=>p.id===field.value)?.last_name}, ${pilots.find(p=>p.id===field.value)?.first_name}` : "Seleccionar piloto"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm} /><CommandList><CommandEmpty>No se encontraron pilotos.</CommandEmpty><CommandGroup>
                    {pilots.map((p) => (<CommandItem value={`${p.last_name}, ${p.first_name}`} key={p.id} onSelect={() => { form.setValue("pilot_id", p.id); setPilotPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", p.id === field.value ? "opacity-100" : "opacity-0")} />{p.last_name}, {p.first_name}</CommandItem>))}
                </CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>
            )}/>
            
            {watchedPilotId && pilotCategoriesForSelectedPilot.length > 0 && (
              <FormField
                control={form.control}
                name="category_selections"
                render={() => (
                  <FormItem>
                    <FormLabel>Categorías para el Turno</FormLabel>
                    <div className="space-y-2">
                      {pilotCategoriesForSelectedPilot.map(category => (
                        <Controller
                          key={category.id}
                          name="category_selections"
                          control={form.control}
                          render={({ field }) => {
                            const isSelected = field.value.some(sel => sel.categoryId === category.id);
                            return (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                                <FormControl>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const currentSelections = field.value;
                                      const newSelections = checked
                                        ? [...currentSelections, { categoryId: category.id, aircraftIds: [] }]
                                        : currentSelections.filter(sel => sel.categoryId !== category.id);
                                      field.onChange(newSelections);
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal flex-1 cursor-pointer">{category.name}</FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {watchedCategorySelections.length > 0 && (
               <FormField
                  control={form.control}
                  name="category_selections"
                  render={() => (
                    <FormItem>
                      <FormLabel>Asignación de Aeronaves</FormLabel>
                       <div className="space-y-2">
                        {watchedCategorySelections.map((selection, index) => {
                           const category = categories.find(c => c.id === selection.categoryId);
                           if (!category) return null;

                            const normalizedCatName = normalizeCategoryName(category.name);
                            const aircraftForThisCategory = aircraft.filter(ac => {
                                if (normalizedCatName.includes('planeador')) return ac.type === 'Glider';
                                if (normalizedCatName.includes('remolcador')) return ac.type === 'Tow Plane';
                                if (normalizedCatName.includes('avion')) return ac.type === 'Avión' || ac.type === 'Tow Plane';
                                return false;
                            });

                           return (
                            <div key={selection.categoryId} className="p-3 border rounded-md">
                                <p className="font-semibold text-sm mb-2">{category?.name}</p>
                                {aircraftForThisCategory.length > 0 ? (
                                    <div className="space-y-1">
                                    {aircraftForThisCategory.map(ac => (
                                        <Controller
                                            key={ac.id}
                                            name={`category_selections.${index}.aircraftIds`}
                                            control={form.control}
                                            render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value.includes(ac.id)}
                                                        onCheckedChange={(checked) => {
                                                            const newAircraftIds = checked
                                                            ? [...field.value, ac.id]
                                                            : field.value.filter(id => id !== ac.id);
                                                            field.onChange(newAircraftIds);
                                                        }}
                                                        disabled={ac.is_out_of_service}
                                                    />
                                                </FormControl>
                                                <FormLabel className={cn("font-normal", ac.is_out_of_service && "text-muted-foreground line-through")}>
                                                    {ac.name}
                                                    {ac.is_out_of_service && <span className="text-xs"> (Fuera de servicio)</span>}
                                                </FormLabel>
                                            </FormItem>
                                            )}
                                        />
                                    ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No hay aeronaves disponibles para esta categoría.</p>
                                )}
                            </div>
                           )
                        })}
                       </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}

            <FormField control={form.control} name="start_time" render={({ field }) => (
                <FormItem><FormLabel>Disponible desde (HH:MM)</FormLabel><FormControl>
                    <Input type="text" placeholder="09:00" {...field} onBlur={handleTimeInputBlur} />
                </FormControl><FormMessage /></FormItem>
            )}/>

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
