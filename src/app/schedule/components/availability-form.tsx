
"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft } from '@/types';
import { FLIGHT_TYPES } from '@/types';
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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotsStore } from '@/store/data-hooks';

// Simplified schema for this step
const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM).").min(1, "La hora de inicio es obligatoria."),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  pilot_category_ids: z.array(z.string()).min(1, "Seleccione al menos una categoría de disponibilidad.").optional(),
});

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let h = 8; h <= 20; h++) {
    const minutesToGenerate = (h === 20) ? [0] : [0, 30];
    for (const m of minutesToGenerate) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      slots.push(`${hour}:${minute}`);
    }
  }
  return slots;
};
const timeSlots = generateTimeSlots();

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
      date: selectedDate || new Date(),
      start_time: '',
      pilot_id: '',
      pilot_category_ids: [],
    },
  });

  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

  const watchedPilotId = form.watch('pilot_id');

  useEffect(() => {
    if (currentUser && pilots && pilots.length > 0) {
      const userPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      setCurrentUserLinkedPilotId(userPilot?.id || null);
    }
  }, [currentUser, pilots]);
  
  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);


  useEffect(() => {
    if (open) {
      let initialPilotId = '';
      if (!entry && currentUserLinkedPilotId && !currentUser?.is_admin) {
        initialPilotId = currentUserLinkedPilotId;
      } else if (entry) {
        initialPilotId = entry.pilot_id;
      }
      
      const initialFormValues = entry
        ? {
            date: entry.date ? parseISO(entry.date) : (selectedDate || new Date()),
            start_time: entry.start_time ? entry.start_time.substring(0,5) : '',
            pilot_id: initialPilotId,
            pilot_category_ids: [entry.pilot_category_id],
          }
        : {
            date: selectedDate || new Date(),
            start_time: '',
            pilot_id: initialPilotId,
            pilot_category_ids: [],
          };
      form.reset(initialFormValues as any);
    }
  }, [open, entry, selectedDate, form, currentUserLinkedPilotId, currentUser?.is_admin]);

  const handleSubmit = (data: AvailabilityFormData) => {
    const authUserIdToSet = entry?.auth_user_id ?? (currentUser ? currentUser.id : null);
    
    const entriesToCreate: Omit<ScheduleEntry, 'id' | 'created_at'>[] = [];
    
    if (data.pilot_category_ids && data.pilot_category_ids.length > 0) {
        data.pilot_category_ids.forEach(catId => {
            entriesToCreate.push({
                date: format(data.date, 'yyyy-MM-dd'),
                start_time: data.start_time,
                pilot_id: data.pilot_id,
                pilot_category_id: catId,
                // These will be defaulted or handled by a later step
                flight_type_id: 'local', 
                aircraft_id: null,
                is_tow_pilot_available: false,
                auth_user_id: authUserIdToSet
            });
        });
    }

    if (entriesToCreate.length > 0) {
      onSubmit(entriesToCreate, entry?.id);
      onOpenChange(false);
    } else {
      form.setError("root", { type: "manual", message: "Debe seleccionar al menos una categoría." });
    }
  };

  const sortedAndFilteredPilots = useMemo(() => {
    const searchTermLower = pilotSearchTerm.toLowerCase();
    return pilots
      .filter(p => p.last_name.toLowerCase().includes(searchTermLower) || p.first_name.toLowerCase().includes(searchTermLower))
      .sort((a, b) => a.last_name.localeCompare(b.last_name, 'es', { sensitivity: 'base' }) || a.first_name.localeCompare(b.first_name, 'es', { sensitivity: 'base' }));
  }, [pilots, pilotSearchTerm]);

  const disablePilotSelection = !entry && !!currentUserLinkedPilotId && !currentUser?.is_admin;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-red-200">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Turno' : 'Agregar Disponibilidad'}</DialogTitle>
          <DialogDescription>{entry ? 'Modifica los detalles del turno.' : 'Ingresa los detalles del nuevo turno.'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            <FormField control={form.control} name="date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Fecha</FormLabel><Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal bg-white",!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { if(date) field.onChange(date); setIsCalendarOpen(false); }} initialFocus locale={es} /></PopoverContent></Popover><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="start_time" render={({ field }) => ( <FormItem><FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Hora Inicial</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar hora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(slot => (<SelectItem key={slot} value={slot}>{slot}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="pilot_id" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Piloto</FormLabel><Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between bg-white", !field.value && "text-muted-foreground")} disabled={disablePilotSelection}>{field.value && pilots.find(p => p.id === field.value) ? `${pilots.find(p => p.id === field.value)?.last_name}, ${pilots.find(p => p.id === field.value)?.first_name}` : "Seleccionar piloto"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger>{!disablePilotSelection && (<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start"><Command><CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm}/><CommandList><CommandEmpty>No se encontraron pilotos.</CommandEmpty><CommandGroup>{sortedAndFilteredPilots.map((pilot) => (<CommandItem value={`${pilot.last_name}, ${pilot.first_name} (${pilot.id})`} key={pilot.id} onSelect={() => { form.setValue("pilot_id", pilot.id, { shouldValidate: true, shouldDirty: true }); form.setValue("pilot_category_ids", []); setPilotPopoverOpen(false); setPilotSearchTerm('');}}><Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")}/>{pilot.last_name}, {pilot.first_name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>)}</Popover><FormMessage /></FormItem>)}/>
            
            {watchedPilotId && pilotCategoriesForSelectedPilot.length > 0 && (
                 <FormField
                    control={form.control}
                    name="pilot_category_ids"
                    render={() => (
                      <FormItem className="rounded-md border p-4 bg-white/50">
                        <div className="mb-4">
                          <FormLabel className="text-base font-semibold">
                            Categorías de Disponibilidad
                          </FormLabel>
                          <FormDescription>
                            Seleccione una o más categorías para el turno.
                          </FormDescription>
                        </div>
                        <div className="space-y-2">
                            {pilotCategoriesForSelectedPilot.map((item) => (
                              <FormField
                                key={item.id}
                                control={form.control}
                                name="pilot_category_ids"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={item.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(item.id)}
                                          onCheckedChange={(checked) => {
                                            const currentValue = field.value || [];
                                            return checked
                                              ? field.onChange([...currentValue, item.id])
                                              : field.onChange(
                                                  currentValue?.filter(
                                                    (value) => value !== item.id
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {item.name}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">
                {entry ? 'Guardar Cambios' : 'Agregar Turno(s)'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    