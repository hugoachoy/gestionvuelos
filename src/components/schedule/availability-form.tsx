
"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft, FlightType } from '@/types';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarIcon, AlertTriangle, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays, isBefore, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEffect, useState } from 'react';

// Schema uses snake_case matching the Type and DB
const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM).").min(1, "La hora de inicio es obligatoria."),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  pilot_category_id: z.string().min(1, "Seleccione una categoría para este turno."),
  is_tow_pilot_available: z.boolean().optional(),
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
  selectedDate?: Date; 
  existingEntries: ScheduleEntry[]; // For checking glider conflicts
}

interface MedicalWarningState {
  show: boolean;
  title: string;
  message: string;
  variant: 'default' | 'destructive';
}

interface BookingConflictWarningState {
  show: boolean;
  message: string;
}

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

  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: entry
      ? { ...entry, date: entry.date ? parseISO(entry.date) : new Date(), aircraft_id: entry.aircraft_id ?? '' }
      : {
          date: selectedDate || new Date(),
          start_time: '',
          pilot_id: '',
          pilot_category_id: '',
          is_tow_pilot_available: false,
          flight_type_id: '',
          aircraft_id: '',
        },
  });

  const [medicalWarning, setMedicalWarning] = useState<MedicalWarningState | null>(null);
  const [bookingConflictWarning, setBookingConflictWarning] = useState<BookingConflictWarningState | null>(null);

  useEffect(() => {
    if (selectedDate && !entry) {
      form.setValue('date', selectedDate);
    }
    if (!open) {
      setMedicalWarning(null); 
      setBookingConflictWarning(null); // Clear glider conflict warning when dialog closes
    }
  }, [selectedDate, form, entry, open]);

  const watchedPilotId = form.watch('pilot_id');
  const watchedDate = form.watch('date'); 
  const watchedAircraftId = form.watch('aircraft_id');
  const watchedStartTime = form.watch('start_time');

  const pilotDetails = pilots.find(p => p.id === watchedPilotId);
  const pilotCategoriesForSelectedPilot = pilotDetails?.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[] || [];
  const selectedCategoryDetails = categories.find(c => c.id === form.watch('pilot_category_id'));
  const isTowPilotCategorySelected = selectedCategoryDetails?.name === 'Piloto remolcador';

  // Medical Expiry Check
  useEffect(() => {
    let newMedicalWarningInfo: MedicalWarningState | null = null;
    const currentPilotDetails = pilots.find(p => p.id === watchedPilotId);
    const formFlightDate = watchedDate;

    if (open && watchedPilotId && currentPilotDetails?.medical_expiry && isValid(formFlightDate)) {
      const medicalExpiryDate = parseISO(currentPilotDetails.medical_expiry);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today to start of day

      if (isValid(medicalExpiryDate)) {
        const isExpiredOnFlightDate = isBefore(medicalExpiryDate, formFlightDate);
        
        if (isExpiredOnFlightDate) {
          newMedicalWarningInfo = {
            show: true,
            title: "¡Psicofísico Vencido para esta Fecha!",
            message: `El psicofísico de ${currentPilotDetails.first_name} ${currentPilotDetails.last_name} VENCÍO el ${format(medicalExpiryDate, 'dd/MM/yyyy', { locale: es })}. No puede ser asignado.`,
            variant: 'destructive',
          };
        } else {
          const daysUntilExpiryFromToday = differenceInDays(medicalExpiryDate, today);
          if (daysUntilExpiryFromToday <= 30) { // Expiring in 30 days or less (from today)
            newMedicalWarningInfo = {
              show: true,
              title: "¡Psicofísico Vence en Muy Poco Tiempo!",
              message: `El psicofísico de ${currentPilotDetails.first_name} ${currentPilotDetails.last_name} vence en ${daysUntilExpiryFromToday} días (el ${format(medicalExpiryDate, 'dd/MM/yyyy', { locale: es })}).`,
              variant: 'destructive', // Red alert
            };
          } else if (daysUntilExpiryFromToday <= 60) { // Expiring in 60 days or less (from today)
            newMedicalWarningInfo = {
              show: true,
              title: "Advertencia de Psicofísico",
              message: `El psicofísico de ${currentPilotDetails.first_name} ${currentPilotDetails.last_name} vence en ${daysUntilExpiryFromToday} días (el ${format(medicalExpiryDate, 'dd/MM/yyyy', { locale: es })}).`,
              variant: 'default', // Yellow alert (styled via cn)
            };
          }
        }
      }
    }
    setMedicalWarning(newMedicalWarningInfo);
  }, [watchedPilotId, watchedDate, open, pilots]);

  // Glider Booking Conflict Check
  useEffect(() => {
    setBookingConflictWarning(null); // Reset on relevant changes

    if (!watchedAircraftId || !watchedStartTime || !watchedDate || !aircraft.length || !existingEntries?.length) {
      return;
    }

    const selectedAircraftDetails = aircraft.find(a => a.id === watchedAircraftId);
    if (!selectedAircraftDetails || selectedAircraftDetails.type !== 'Glider') {
      return; // Only check for gliders
    }

    const dateString = format(watchedDate, 'yyyy-MM-dd');

    const conflictingEntry = existingEntries.find(
      (se) =>
        se.date === dateString &&
        se.start_time === watchedStartTime &&
        se.aircraft_id === watchedAircraftId &&
        (!entry || se.id !== entry.id) // Exclude current entry if editing
    );

    if (conflictingEntry) {
      setBookingConflictWarning({
        show: true,
        message: `El planeador ${selectedAircraftDetails.name} ya está reservado para las ${watchedStartTime.substring(0,5)} en esta fecha.`,
      });
    }
  }, [watchedAircraftId, watchedStartTime, watchedDate, aircraft, existingEntries, entry]);


  const handleSubmit = (data: AvailabilityFormData) => {
    // Prevent submission if there's a destructive medical warning or a glider conflict
    if ((medicalWarning && medicalWarning.variant === 'destructive' && medicalWarning.show) || (bookingConflictWarning && bookingConflictWarning.show)) {
        // Optionally, show a toast message here if needed
        return;
    }

    const dataToSubmit: Omit<ScheduleEntry, 'id' | 'created_at'> = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'), 
        aircraft_id: data.aircraft_id || undefined, 
    };
    onSubmit(dataToSubmit, entry?.id);
    form.reset({
      date: selectedDate || new Date(),
      start_time: '',
      pilot_id: '',
      pilot_category_id: '',
      is_tow_pilot_available: false,
      flight_type_id: '',
      aircraft_id: '',
    });
    onOpenChange(false);
  };
  
  useEffect(() => {
    if (watchedPilotId && pilotDetails && !pilotDetails.category_ids.includes(form.getValues('pilot_category_id'))) {
      form.setValue('pilot_category_id', '');
    }
    if (!watchedPilotId) {
        setMedicalWarning(null);
    }
  }, [watchedPilotId, pilotDetails, form]);


  useEffect(() => {
    if (open) {
       form.reset(entry
        ? { ...entry, date: entry.date ? parseISO(entry.date) : new Date(), aircraft_id: entry.aircraft_id ?? '' }
        : {
            date: selectedDate || new Date(),
            start_time: '',
            pilot_id: '',
            pilot_category_id: '',
            is_tow_pilot_available: false,
            flight_type_id: '',
            aircraft_id: '',
          });
    } else {
      setMedicalWarning(null); 
      setBookingConflictWarning(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, selectedDate]); 


  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
    }}>
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
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora Inicial</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar hora" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeSlots.map(slot => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pilot_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Piloto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar piloto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pilots.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {medicalWarning && medicalWarning.show && (
              <Alert variant={medicalWarning.variant} className={cn(medicalWarning.variant === 'default' ? "border-yellow-500" : "")}>
                <AlertTriangle className={cn("h-4 w-4", medicalWarning.variant === 'default' && "text-yellow-500")} />
                <AlertTitle>{medicalWarning.title}</AlertTitle>
                <AlertDescription>{medicalWarning.message}</AlertDescription>
              </Alert>
            )}

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
                          <SelectValue placeholder={pilotCategoriesForSelectedPilot.length > 0 ? "Seleccionar categoría del piloto" : "Piloto no tiene categorías"} />
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
            {isTowPilotCategorySelected && (
              <FormField
                control={form.control}
                name="is_tow_pilot_available"
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
              name="flight_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
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
              name="aircraft_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aeronave (Opcional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === 'NO_AIRCRAFT_SELECTED_VALUE' ? null : value)} 
                    value={field.value ?? 'NO_AIRCRAFT_SELECTED_VALUE'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar aeronave" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NO_AIRCRAFT_SELECTED_VALUE"><em>Ninguna</em></SelectItem>
                      {aircraft.map(ac => (
                        <SelectItem key={ac.id} value={ac.id}>{ac.name} ({ac.type === 'Glider' ? 'Planeador' : 'Remolcador'})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             {bookingConflictWarning && bookingConflictWarning.show && (
              <Alert variant="destructive" className="mt-2">
                <Plane className="h-4 w-4" /> {/* Or AlertTriangle if preferred */}
                <AlertTitle>Conflicto de Reserva</AlertTitle>
                <AlertDescription>{bookingConflictWarning.message}</AlertDescription>
              </Alert>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => {
                form.reset({
                  date: selectedDate || new Date(),
                  start_time: '',
                  pilot_id: '',
                  pilot_category_id: '',
                  is_tow_pilot_available: false,
                  flight_type_id: '',
                  aircraft_id: '',
                }); 
                onOpenChange(false);
                }}>Cancelar</Button>
              <Button 
                type="submit" 
                disabled={
                  (medicalWarning?.show && medicalWarning.variant === 'destructive') || 
                  (bookingConflictWarning?.show ?? false)
                }
              >
                {entry ? 'Guardar Cambios' : 'Agregar Turno'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
