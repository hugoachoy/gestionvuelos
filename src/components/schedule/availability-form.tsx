"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft, FlightType } from '@/types';
import { FLIGHT_TYPES } from '@/types';
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
import { Switch } from '@/components/ui/switch';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEffect } from 'react';

const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM)."),
  pilotId: z.string().min(1, "Seleccione un piloto."),
  pilotCategoryId: z.string().min(1, "Seleccione una categoría para este turno."),
  isTowPilotAvailable: z.boolean().optional(),
  flightTypeId: z.string().min(1, "Seleccione un tipo de vuelo."),
  aircraftId: z.string().optional(),
});

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface AvailabilityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AvailabilityFormData, entryId?: string) => void;
  entry?: ScheduleEntry;
  pilots: Pilot[];
  categories: PilotCategory[];
  aircraft: Aircraft[];
  selectedDate?: Date; // To prefill date from calendar
}

export function AvailabilityForm({
  open,
  onOpenChange,
  onSubmit,
  entry,
  pilots,
  categories,
  aircraft,
  selectedDate
}: AvailabilityFormProps) {

  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: entry
      ? { ...entry, date: entry.date ? parseISO(entry.date) : new Date() }
      : {
          date: selectedDate || new Date(),
          startTime: '',
          pilotId: '',
          pilotCategoryId: '',
          isTowPilotAvailable: false,
          flightTypeId: '',
          aircraftId: '',
        },
  });

  useEffect(() => {
    if (selectedDate && !entry) {
      form.setValue('date', selectedDate);
    }
  }, [selectedDate, form, entry]);

  const watchedPilotId = form.watch('pilotId');
  const watchedPilotCategoryId = form.watch('pilotCategoryId');

  const pilotDetails = pilots.find(p => p.id === watchedPilotId);
  const pilotCategories = pilotDetails?.categoryIds.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[] || [];
  const selectedCategoryDetails = categories.find(c => c.id === watchedPilotCategoryId);
  const isTowPilotCategorySelected = selectedCategoryDetails?.name === 'Piloto remolcador';

  const handleSubmit = (data: AvailabilityFormData) => {
    onSubmit(data, entry?.id);
    form.reset({
      date: selectedDate || new Date(),
      startTime: '',
      pilotId: '',
      pilotCategoryId: '',
      isTowPilotAvailable: false,
      flightTypeId: '',
      aircraftId: '',
    });
    onOpenChange(false);
  };
  
  useEffect(() => {
    // Reset pilotCategoryId if selected pilot changes and current category is not valid for new pilot
    if (watchedPilotId && pilotDetails && !pilotDetails.categoryIds.includes(form.getValues('pilotCategoryId'))) {
      form.setValue('pilotCategoryId', '');
    }
  }, [watchedPilotId, pilotDetails, form]);


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
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
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
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora Inicial (HH:MM)</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pilotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Piloto</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar piloto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pilots.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchedPilotId && (
               <FormField
                control={form.control}
                name="pilotCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría del Piloto para este Turno</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={!pilotDetails || pilotCategories.length === 0}>
                          <SelectValue placeholder={pilotCategories.length > 0 ? "Seleccionar categoría del piloto" : "Piloto no tiene categorías"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pilotCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {isTowPilotCategorySelected && (
              <FormField
                control={form.control}
                name="isTowPilotAvailable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Disponible para Remolque</FormLabel>
                      <FormDescription>
                        ¿El piloto remolcador está disponible?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="flightTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo de vuelo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FLIGHT_TYPES.map(ft => (
                        <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aircraftId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aeronave (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar aeronave" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {aircraft.map(ac => (
                        <SelectItem key={ac.id} value={ac.id}>{ac.name} ({ac.type === 'Glider' ? 'Planeador' : 'Remolcador'})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => {form.reset(); onOpenChange(false);}}>Cancelar</Button>
              <Button type="submit">{entry ? 'Guardar Cambios' : 'Agregar Turno'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
