
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
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FLIGHT_TYPES } from '@/types';

// Simplified schema to handle one entry at a time, which is more robust.
const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  pilot_category_id: z.string().min(1, "Seleccione una categoría para este turno."),
  is_tow_pilot_available: z.boolean().optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM)."),
  flight_type_id: z.string().min(1, "Seleccione un tipo de vuelo."),
  aircraft_id: z.string().optional().nullable(),
});

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface AvailabilityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<ScheduleEntry, 'id' | 'created_at'>, entryId?: string) => void;
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
}: AvailabilityFormProps) {
  const { user: currentUser } = useAuth();
  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      date: selectedDate,
      pilot_id: '',
      pilot_category_id: '',
      start_time: '09:00',
      flight_type_id: 'local',
      aircraft_id: null,
      is_tow_pilot_available: false,
    },
  });

  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
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
            ...entry,
            date: entry.date ? parseISO(entry.date) : selectedDate,
            start_time: entry.start_time.substring(0, 5),
          }
        : {
            date: selectedDate,
            pilot_id: !currentUser?.is_admin ? currentUserLinkedPilotId || '' : '',
            pilot_category_id: '',
            start_time: '09:00',
            flight_type_id: 'local',
            aircraft_id: null,
            is_tow_pilot_available: false,
          };
      form.reset(initialValues);
    }
  }, [open, entry, selectedDate, currentUser, currentUserLinkedPilotId, form]);

  const watchedPilotId = form.watch('pilot_id');
  const watchedCategoryId = form.watch('pilot_category_id');

  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);

  const availableAircraft = useMemo(() => {
    if (!watchedCategoryId) return [];
    const category = categories.find(c => c.id === watchedCategoryId);
    const normalizedName = normalizeCategoryName(category?.name);
    
    const relevantTypes = new Set<Aircraft['type']>();
    if (normalizedName.includes('planeador')) relevantTypes.add('Glider');
    if (normalizedName.includes('avion')) {
      relevantTypes.add('Avión');
      relevantTypes.add('Tow Plane');
    }
    if (normalizedName.includes('remolcador')) relevantTypes.add('Tow Plane');

    return aircraft.filter(ac => relevantTypes.has(ac.type) && !ac.is_out_of_service);
  }, [watchedCategoryId, categories, aircraft]);

  const isRemolcadorCategorySelected = useMemo(() => {
    const cat = categories.find(c => c.id === watchedCategoryId);
    return normalizeCategoryName(cat?.name) === NORMALIZED_REMOLCADOR;
  }, [watchedCategoryId, categories]);

  useEffect(() => {
    if (watchedPilotId) form.setValue('pilot_category_id', '');
  }, [watchedPilotId, form]);

  useEffect(() => {
    form.setValue('aircraft_id', null);
  }, [watchedCategoryId, form]);


  const handleSubmit = (data: AvailabilityFormData) => {
    const dataToSubmit: Omit<ScheduleEntry, 'id' | 'created_at'> = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        auth_user_id: entry?.auth_user_id || currentUser?.id || null,
        is_tow_pilot_available: isRemolcadorCategorySelected ? data.is_tow_pilot_available : false,
    };
    onSubmit(dataToSubmit, entry?.id);
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
            <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Fecha</FormLabel><Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}><PopoverTrigger asChild><FormControl>
                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}</Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(d) => { if (d) field.onChange(d); setIsCalendarOpen(false); }} initialFocus locale={es} /></PopoverContent></Popover><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="pilot_id" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Piloto</FormLabel><Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}><PopoverTrigger asChild><FormControl>
                    <Button variant="outline" role="combobox" disabled={!currentUser?.is_admin && !!currentUserLinkedPilotId} className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>{field.value ? `${pilots.find(p=>p.id===field.value)?.last_name}, ${pilots.find(p=>p.id===field.value)?.first_name}` : "Seleccionar piloto"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                </FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm} /><CommandList><CommandEmpty>No se encontraron pilotos.</CommandEmpty><CommandGroup>
                    {pilots.map((p) => (<CommandItem value={`${p.last_name}, ${p.first_name}`} key={p.id} onSelect={() => { form.setValue("pilot_id", p.id); setPilotPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", p.id === field.value ? "opacity-100" : "opacity-0")} />{p.last_name}, {p.first_name}</CommandItem>))}
                </CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>
            )}/>
            {watchedPilotId && (<>
                <FormField control={form.control} name="pilot_category_id" render={({ field }) => (
                    <FormItem><FormLabel>Categoría para el Turno</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                    </FormControl><SelectContent>
                        {pilotCategoriesForSelectedPilot.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                    </SelectContent></Select><FormMessage /></FormItem>
                )}/>
                {availableAircraft.length > 0 && (<FormField control={form.control} name="aircraft_id" render={({ field }) => (
                    <FormItem><FormLabel>Aeronave (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value ?? undefined}><FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccionar aeronave (opcional)" /></SelectTrigger>
                    </FormControl><SelectContent>
                        {availableAircraft.map(ac => (<SelectItem key={ac.id} value={ac.id}>{ac.name}</SelectItem>))}
                    </SelectContent></Select><FormMessage /></FormItem>
                )}/>)}
            </>)}
            <FormField control={form.control} name="start_time" render={({ field }) => (
                <FormItem><FormLabel>Disponible desde (HH:MM)</FormLabel><FormControl>
                    <Input type="text" placeholder="09:00" {...field} onBlur={handleTimeInputBlur} />
                </FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="flight_type_id" render={({ field }) => (
                <FormItem><FormLabel>Tipo de Vuelo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl>
                    <SelectTrigger><SelectValue placeholder="Seleccionar tipo de vuelo" /></SelectTrigger>
                </FormControl><SelectContent>
                    {FLIGHT_TYPES.map(ft => (<SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>))}
                </SelectContent></Select><FormMessage /></FormItem>
            )}/>
            {isRemolcadorCategorySelected && (
              <FormField control={form.control} name="is_tow_pilot_available" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2">
                    <div className="space-y-0.5"><FormLabel>¿Disponible como Remolcador?</FormLabel><FormDescription>Marca si estarás disponible para remolcar.</FormDescription></div>
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
              )}/>
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
