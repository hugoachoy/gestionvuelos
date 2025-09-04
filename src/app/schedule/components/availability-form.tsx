
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, AlertTriangle, Plane as PlaneIconLucide, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isBefore, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotsStore } from '@/store/data-hooks';

const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM).").min(1, "La hora de inicio es obligatoria."),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  
  // New checkboxes for availability roles
  availableAsTowPilot: z.boolean().optional(),
  availableAsGliderInstructor: z.boolean().optional(),
  availableAsEngineInstructor: z.boolean().optional(),
  
  // These fields will now often be optional or derived
  pilot_category_id: z.string().optional(),
  flight_type_id: z.string().optional(),
  aircraft_id: z.string().optional(),
}).refine(data => {
    // If no special role is selected, then the main fields must be filled
    if (!data.availableAsTowPilot && !data.availableAsGliderInstructor && !data.availableAsEngineInstructor) {
        return data.pilot_category_id && data.flight_type_id && data.aircraft_id;
    }
    return true; // If any special role is checked, validation passes
}, {
    message: "Debe completar la categoría, tipo de vuelo y aeronave si no selecciona un rol especial.",
    path: ["pilot_category_id"], 
});

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;


interface MedicalWarningState {
  show: boolean;
  title: string;
  message: string;
  variant: 'default' | 'destructive';
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

const NORMALIZED_INSTRUCTOR_AVION = "instructor avion";
const NORMALIZED_INSTRUCTOR_PLANEADOR = "instructor planeador";
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
}: AvailabilityFormProps) {
  const { user: currentUser } = useAuth();
  const { getPilotName } = usePilotsStore();
  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
        date: selectedDate || new Date(),
        start_time: '',
        pilot_id: '',
        pilot_category_id: '',
        flight_type_id: '',
        aircraft_id: '',
        availableAsTowPilot: false,
        availableAsGliderInstructor: false,
        availableAsEngineInstructor: false,
      },
  });

  const [medicalWarning, setMedicalWarning] = useState<MedicalWarningState | null>(null);
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

  const watchedPilotId = form.watch('pilot_id');
  const watchedDate = form.watch('date');
  const watchedStartTime = form.watch('start_time');

  useEffect(() => {
    if (currentUser && pilots && pilots.length > 0) {
      const userPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      setCurrentUserLinkedPilotId(userPilot?.id || null);
    }
  }, [currentUser, pilots]);

  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);

  const pilotSpecialCategories = useMemo(() => {
    if (!pilotDetails?.category_ids) return {};
    const specialCats: { isTowPilot?: boolean, isGliderInstructor?: boolean, isEngineInstructor?: boolean } = {};
    pilotDetails.category_ids.forEach(id => {
        const cat = categories.find(c => c.id === id);
        const normalizedName = normalizeCategoryName(cat?.name);
        if (normalizedName === NORMALIZED_REMOLCADOR) specialCats.isTowPilot = true;
        if (normalizedName === NORMALIZED_INSTRUCTOR_PLANEADOR) specialCats.isGliderInstructor = true;
        if (normalizedName === NORMALIZED_INSTRUCTOR_AVION) specialCats.isEngineInstructor = true;
    });
    return specialCats;
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
            ...entry,
            date: entry.date ? parseISO(entry.date) : (selectedDate || new Date()),
            start_time: entry.start_time ? entry.start_time.substring(0,5) : '',
            pilot_id: initialPilotId,
          }
        : {
            date: selectedDate || new Date(),
            start_time: '',
            pilot_id: initialPilotId,
            pilot_category_id: '',
            flight_type_id: '',
            aircraft_id: '',
            availableAsTowPilot: false,
            availableAsGliderInstructor: false,
            availableAsEngineInstructor: false,
          };
      form.reset(initialFormValues as any);
    }
  }, [open, entry, selectedDate, form, currentUserLinkedPilotId, currentUser?.is_admin]);

  useEffect(() => {
    let newMedicalWarningInfo: MedicalWarningState | null = null;
    if (open && watchedPilotId && pilotDetails?.medical_expiry && isValid(watchedDate)) {
      const medicalExpiryDate = parseISO(pilotDetails.medical_expiry);
      if (isValid(medicalExpiryDate)) {
        const normalizedFormFlightDate = startOfDay(watchedDate);
        const normalizedMedicalExpiryDate = startOfDay(medicalExpiryDate);
        if (isBefore(normalizedMedicalExpiryDate, normalizedFormFlightDate)) {
          newMedicalWarningInfo = {
            show: true,
            title: "¡Psicofísico Vencido para esta Fecha!",
            message: `El psicofísico de ${pilotDetails.first_name} ${pilotDetails.last_name} VENCÍO el ${format(normalizedMedicalExpiryDate, 'dd/MM/yyyy', { locale: es })}. No puede ser asignado.`,
            variant: 'destructive',
          };
        }
      }
    }
    setMedicalWarning(newMedicalWarningInfo);
  }, [watchedPilotId, watchedDate, open, pilotDetails]);

  const handleSubmit = (data: AvailabilityFormData) => {
    if ((medicalWarning && medicalWarning.variant === 'destructive' && medicalWarning.show)) return;

    const entriesToCreate: Omit<ScheduleEntry, 'id' | 'created_at'>[] = [];
    const authUserIdToSet = entry?.auth_user_id ?? (currentUser ? currentUser.id : null);
    
    // Logic for special availability roles
    if(data.availableAsTowPilot) {
        const towCategory = categories.find(c => normalizeCategoryName(c.name) === NORMALIZED_REMOLCADOR);
        if(towCategory) {
            entriesToCreate.push({
                date: format(data.date, 'yyyy-MM-dd'),
                start_time: data.start_time,
                pilot_id: data.pilot_id,
                pilot_category_id: towCategory.id,
                is_tow_pilot_available: true,
                flight_type_id: 'towage',
                aircraft_id: null,
                auth_user_id: authUserIdToSet
            });
        }
    }
    if(data.availableAsGliderInstructor) {
        const gliderInstructorCategory = categories.find(c => normalizeCategoryName(c.name) === NORMALIZED_INSTRUCTOR_PLANEADOR);
        if(gliderInstructorCategory) {
            entriesToCreate.push({
                date: format(data.date, 'yyyy-MM-dd'),
                start_time: data.start_time,
                pilot_id: data.pilot_id,
                pilot_category_id: gliderInstructorCategory.id,
                flight_type_id: 'instruction_given',
                aircraft_id: null,
                auth_user_id: authUserIdToSet
            });
        }
    }
    if(data.availableAsEngineInstructor) {
        const engineInstructorCategory = categories.find(c => normalizeCategoryName(c.name) === NORMALIZED_INSTRUCTOR_AVION);
        if(engineInstructorCategory) {
            entriesToCreate.push({
                date: format(data.date, 'yyyy-MM-dd'),
                start_time: data.start_time,
                pilot_id: data.pilot_id,
                pilot_category_id: engineInstructorCategory.id,
                flight_type_id: 'instruction_given',
                aircraft_id: null,
                auth_user_id: authUserIdToSet
            });
        }
    }

    // Logic for a regular flight booking if no special role is selected
    if (entriesToCreate.length === 0 && data.pilot_category_id && data.flight_type_id && data.aircraft_id) {
        entriesToCreate.push({
            date: format(data.date, 'yyyy-MM-dd'),
            start_time: data.start_time,
            pilot_id: data.pilot_id,
            pilot_category_id: data.pilot_category_id,
            flight_type_id: data.flight_type_id,
            aircraft_id: data.aircraft_id,
            auth_user_id: authUserIdToSet,
        });
    }

    if (entriesToCreate.length > 0) {
      onSubmit(entriesToCreate, entry?.id);
      onOpenChange(false);
    } else {
      // This should be caught by Zod refine, but as a fallback.
      form.setError("root", { type: "manual", message: "Debe seleccionar una disponibilidad especial o completar los detalles del turno." });
    }
  };

  const sortedAndFilteredPilots = useMemo(() => {
    const searchTermLower = pilotSearchTerm.toLowerCase();
    return pilots
      .filter(p => p.last_name.toLowerCase().includes(searchTermLower) || p.first_name.toLowerCase().includes(searchTermLower))
      .sort((a, b) => a.last_name.localeCompare(b.last_name, 'es', { sensitivity: 'base' }) || a.first_name.localeCompare(b.first_name, 'es', { sensitivity: 'base' }));
  }, [pilots, pilotSearchTerm]);

  const disablePilotSelection = !entry && !!currentUserLinkedPilotId && !currentUser?.is_admin;
  
  const showSpecialAvailabilityOptions = watchedPilotId && watchedStartTime && (pilotSpecialCategories.isTowPilot || pilotSpecialCategories.isGliderInstructor || pilotSpecialCategories.isEngineInstructor);
  const showRegularBookingFields = watchedPilotId && watchedStartTime && !form.getValues('availableAsTowPilot') && !form.getValues('availableAsGliderInstructor') && !form.getValues('availableAsEngineInstructor');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar Turno' : 'Agregar Disponibilidad'}</DialogTitle>
          <DialogDescription>{entry ? 'Modifica los detalles del turno.' : 'Ingresa los detalles del nuevo turno.'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            {/* Fields that are always visible */}
            <FormField control={form.control} name="date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Fecha</FormLabel><Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { if(date) field.onChange(date); setIsCalendarOpen(false); }} initialFocus locale={es} /></PopoverContent></Popover><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="start_time" render={({ field }) => ( <FormItem><FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Hora Inicial</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar hora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(slot => (<SelectItem key={slot} value={slot}>{slot}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="pilot_id" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Piloto</FormLabel><Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={disablePilotSelection}>{field.value && pilots.find(p => p.id === field.value) ? `${pilots.find(p => p.id === field.value)?.last_name}, ${pilots.find(p => p.id === field.value)?.first_name}` : "Seleccionar piloto"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger>{!disablePilotSelection && (<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start"><Command><CommandInput placeholder="Buscar piloto..." value={pilotSearchTerm} onValueChange={setPilotSearchTerm}/><CommandList><CommandEmpty>No se encontraron pilotos.</CommandEmpty><CommandGroup>{sortedAndFilteredPilots.map((pilot) => (<CommandItem value={`${pilot.last_name}, ${pilot.first_name} (${pilot.id})`} key={pilot.id} onSelect={() => { form.setValue("pilot_id", pilot.id, { shouldValidate: true, shouldDirty: true }); setPilotPopoverOpen(false); setPilotSearchTerm('');}}><Check className={cn("mr-2 h-4 w-4", pilot.id === field.value ? "opacity-100" : "opacity-0")}/>{pilot.last_name}, {pilot.first_name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>)}</Popover><FormMessage /></FormItem>)}/>
            
            {medicalWarning?.show && ( <Alert variant={medicalWarning.variant}><AlertTriangle className="h-4 w-4" /><AlertTitle>{medicalWarning.title}</AlertTitle><AlertDescription>{medicalWarning.message}</AlertDescription></Alert> )}
            
            {/* Conditional Special Availability Options */}
            {showSpecialAvailabilityOptions && (
              <div className="space-y-2 pt-2 border-t mt-4">
                  <FormLabel className="text-base font-semibold text-foreground">Disponibilidad de Roles Especiales</FormLabel>
                  <FormDescription>Selecciona los roles en los que este piloto estará disponible a esta hora.</FormDescription>
                  {pilotSpecialCategories.isTowPilot && (
                      <FormField control={form.control} name="availableAsTowPilot" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Disponible como Remolcador</FormLabel></div></FormItem>)}/>
                  )}
                  {pilotSpecialCategories.isGliderInstructor && (
                      <FormField control={form.control} name="availableAsGliderInstructor" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Disponible como Instructor de Planeador</FormLabel></div></FormItem>)}/>
                  )}
                  {pilotSpecialCategories.isEngineInstructor && (
                      <FormField control={form.control} name="availableAsEngineInstructor" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Disponible como Instructor de Avión</FormLabel></div></FormItem>)}/>
                  )}
              </div>
            )}
            
            {/* Conditional Regular Booking Fields */}
            {showRegularBookingFields && (
                <div className="space-y-4 pt-4 border-t mt-4">
                    <FormLabel className="text-base font-semibold text-foreground">Detalles del Turno Normal</FormLabel>
                    <FormField control={form.control} name="pilot_category_id" render={({ field }) => ( <FormItem><FormLabel className="font-normal">Categoría para este Turno</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger disabled={!pilotDetails}><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger></FormControl><SelectContent>{pilotDetails?.category_ids.map(id => categories.find(c=>c.id===id)).filter(Boolean).map(cat => ( <SelectItem key={cat!.id} value={cat!.id}>{cat!.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="flight_type_id" render={({ field }) => ( <FormItem><FormLabel className="font-normal">Tipo de Vuelo</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger></FormControl><SelectContent>{FLIGHT_TYPES.map(ft => ( <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="aircraft_id" render={({ field }) => ( <FormItem><FormLabel className="font-normal">Aeronave</FormLabel><Select onValueChange={(value) => field.onChange(value)} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Seleccionar aeronave" /></SelectTrigger></FormControl><SelectContent>{aircraft.map(ac => ( <SelectItem key={ac.id} value={ac.id}>{ac.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={medicalWarning?.variant === 'destructive'}>
                {entry ? 'Guardar Cambios' : 'Agregar Turno(s)'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    