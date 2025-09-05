
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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Simplified schema as requested
const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  pilot_category_id: z.string().min(1, "Seleccione una categoría para este turno."),
  is_tow_pilot_available: z.boolean().optional(),
  is_instructor_available: z.boolean().optional(),
  // Fields to be hardcoded or derived, not shown in UI
  start_time: z.string().default('00:00'), 
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
}: AvailabilityFormProps) {
  const { user: currentUser } = useAuth();
  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
        date: selectedDate || new Date(),
        pilot_id: '',
        pilot_category_id: '',
        is_tow_pilot_available: false,
        is_instructor_available: false,
        // Default hidden fields
        start_time: '00:00',
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

      const categoryForEntry = entry?.pilot_category_id ? categories.find(c => c.id === entry.pilot_category_id) : null;
      const normalizedCatName = normalizeCategoryName(categoryForEntry?.name);
      const isEntryCategoryRemolcador = normalizedCatName === NORMALIZED_REMOLCADOR;
      const isEntryCategoryInstructor = normalizedCatName.includes("instructor");

      const initialFormValues = entry
        ? {
            ...entry,
            date: entry.date ? parseISO(entry.date) : (selectedDate || new Date()),
            pilot_id: initialPilotId,
            is_tow_pilot_available: isEntryCategoryRemolcador ? entry.is_tow_pilot_available : false,
            is_instructor_available: isEntryCategoryInstructor ? entry.is_instructor_available : false,
            start_time: entry.start_time || '00:00',
            flight_type_id: entry.flight_type_id || 'local',
            aircraft_id: entry.aircraft_id || null,
          }
        : {
            date: selectedDate || new Date(),
            pilot_id: initialPilotId,
            pilot_category_id: '',
            is_tow_pilot_available: false,
            is_instructor_available: false,
            start_time: '00:00',
            flight_type_id: 'local',
            aircraft_id: null,
          };
      form.reset(initialFormValues as AvailabilityFormData);
      setPilotSearchTerm('');
    }
  }, [open, entry, form, currentUserLinkedPilotId, currentUser?.is_admin, categories]);

  const watchedPilotId = form.watch('pilot_id');
  const watchedPilotCategoryId = form.watch('pilot_category_id');
  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);
  
  const pilotCategoriesForSelectedPilot = useMemo(() => {
    if (!pilotDetails?.category_ids) return [];
    return pilotDetails.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[];
  }, [pilotDetails, categories]);

  const categoryForTurn = useMemo(() => {
    return categories.find(c => c.id === watchedPilotCategoryId);
  }, [watchedPilotCategoryId, categories]);

  const isRemolcadorCategorySelectedForTurn = useMemo(() => {
    return normalizeCategoryName(categoryForTurn?.name) === NORMALIZED_REMOLCADOR;
  }, [categoryForTurn]);

  const isInstructorCategorySelectedForTurn = useMemo(() => {
    return normalizeCategoryName(categoryForTurn?.name).includes("instructor");
  }, [categoryForTurn]);

  useEffect(() => {
    if (watchedPilotId && pilotDetails && form.getValues('pilot_category_id') && !pilotDetails.category_ids.includes(form.getValues('pilot_category_id'))) {
      form.setValue('pilot_category_id', '');
    }
    if (!watchedPilotId) {
        form.setValue('pilot_category_id', '');
    }
  }, [watchedPilotId, pilotDetails, form]);

  useEffect(() => {
    if (!isRemolcadorCategorySelectedForTurn && form.getValues('is_tow_pilot_available')) {
      form.setValue('is_tow_pilot_available', false, { shouldValidate: true });
    }
    if (!isInstructorCategorySelectedForTurn && form.getValues('is_instructor_available')) {
      form.setValue('is_instructor_available', false, { shouldValidate: true });
    }
  }, [isRemolcadorCategorySelectedForTurn, isInstructorCategorySelectedForTurn, form]);

  const handleSubmit = (data: AvailabilityFormData) => {
    let authUserIdToSet: string | null = null;
    if (!entry && currentUser) {
        authUserIdToSet = currentUser.id;
    } else if (entry && entry.auth_user_id) {
        authUserIdToSet = entry.auth_user_id;
    }

    const dataToSubmit: Omit<ScheduleEntry, 'id' | 'created_at'> = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        is_tow_pilot_available: isRemolcadorCategorySelectedForTurn ? data.is_tow_pilot_available : false,
        is_instructor_available: isInstructorCategorySelectedForTurn ? data.is_instructor_available : false,
        auth_user_id: authUserIdToSet,
    };
    onSubmit([dataToSubmit], entry?.id);
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
            {watchedPilotId && (
              <FormField
                control={form.control}
                name="pilot_category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría del Piloto para este Turno</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger disabled={!pilotDetails || pilotCategoriesForSelectedPilot.length === 0}>
                          <SelectValue placeholder={pilotCategoriesForSelectedPilot.length > 0 ? "Seleccionar categoría" : "Piloto no tiene categorías"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pilotCategoriesForSelectedPilot.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {isRemolcadorCategorySelectedForTurn && (
              <FormField
                control={form.control}
                name="is_tow_pilot_available"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2">
                    <div className="space-y-0.5">
                      <FormLabel>¿Disponible como Remolcador?</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
             {isInstructorCategorySelectedForTurn && (
              <FormField
                control={form.control}
                name="is_instructor_available"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2">
                    <div className="space-y-0.5">
                      <FormLabel>¿Disponible como Instructor?</FormLabel>
                    </div>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
