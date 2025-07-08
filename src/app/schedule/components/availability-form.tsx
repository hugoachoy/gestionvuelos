
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
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotsStore } from '@/store/data-hooks'; // Added to get getPilotName for conflict message

const availabilitySchema = z.object({
  date: z.date({ required_error: "La fecha es obligatoria." }),
  start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM).").min(1, "La hora de inicio es obligatoria."),
  pilot_id: z.string().min(1, "Seleccione un piloto."),
  pilot_category_id: z.string().min(1, "Seleccione una categoría para este turno."),
  is_tow_pilot_available: z.boolean().optional(),
  flight_type_id: z.string().min(1, "Seleccione un tipo de vuelo."),
  aircraft_id: z.string().min(1, "La selección de aeronave es obligatoria."),
});

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;

interface MedicalWarningState {
  show: boolean;
  title: string;
  message: string;
  variant: 'default' | 'destructive';
  displayType?: 'critical_non_blocking' | 'warning_non_blocking' | 'info_non_blocking';
}

interface BookingConflictWarningState {
  show: boolean;
  message: string;
}

interface SportFlightAircraftWarningState {
  show: boolean;
  message: string;
  variant?: 'info' | 'warning';
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
  onSubmit: (data: Omit<ScheduleEntry, 'id' | 'created_at'>, entryId?: string) => void;
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
  existingEntries
}: AvailabilityFormProps) {
  const { user: currentUser } = useAuth();
  const { getPilotName } = usePilotsStore(); // For conflict message
  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
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
  const [sportFlightAircraftWarning, setSportFlightAircraftWarning] = useState<SportFlightAircraftWarningState | null>(null);
  const [aircraftWarning, setAircraftWarning] = useState<string | null>(null);
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [pilotPopoverOpen, setPilotPopoverOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [currentUserLinkedPilotId, setCurrentUserLinkedPilotId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && pilots && pilots.length > 0) {
      const userPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      if (userPilot) {
        setCurrentUserLinkedPilotId(userPilot.id);
      } else {
        setCurrentUserLinkedPilotId(null);
      }
    } else {
      setCurrentUserLinkedPilotId(null);
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
      const isEntryCategoryRemolcador = normalizeCategoryName(categoryForEntry?.name) === NORMALIZED_REMOLCADOR;

      const initialFormValues = entry
        ? {
            ...entry,
            date: entry.date ? parseISO(entry.date) : (selectedDate || new Date()),
            aircraft_id: entry.aircraft_id ?? '',
            start_time: entry.start_time ? entry.start_time.substring(0,5) : '',
            pilot_id: initialPilotId,
            is_tow_pilot_available: isEntryCategoryRemolcador ? entry.is_tow_pilot_available : false,
          }
        : {
            date: selectedDate || new Date(),
            start_time: '',
            pilot_id: initialPilotId,
            pilot_category_id: '',
            is_tow_pilot_available: false,
            flight_type_id: '',
            aircraft_id: '',
          };
      form.reset(initialFormValues as AvailabilityFormData);
      
      setPilotSearchTerm('');
      setMedicalWarning(null);
      setBookingConflictWarning(null);
      setSportFlightAircraftWarning(null);
      setAircraftWarning(null);
    }
  }, [open, entry, selectedDate, form, currentUserLinkedPilotId, currentUser?.is_admin, categories]);


  const watchedPilotId = form.watch('pilot_id');
  const watchedDate = form.watch('date');
  const watchedAircraftId = form.watch('aircraft_id');
  const watchedStartTime = form.watch('start_time');
  const watchedPilotCategoryId = form.watch('pilot_category_id');
  const watchedFlightTypeId = form.watch('flight_type_id'); 

  const pilotDetails = useMemo(() => pilots.find(p => p.id === watchedPilotId), [pilots, watchedPilotId]);

  const pilotCategoriesForSelectedPilot = useMemo(() => {
    return pilotDetails?.category_ids.map(id => categories.find(c => c.id === id)).filter(Boolean) as PilotCategory[] || [];
  }, [pilotDetails, categories]);

  const isRemolcadorCategorySelectedForTurn = useMemo(() => {
    const cat = categories.find(c => c.id === watchedPilotCategoryId);
    return normalizeCategoryName(cat?.name) === NORMALIZED_REMOLCADOR;
  }, [watchedPilotCategoryId, categories]);

  useEffect(() => {
    setAircraftWarning(null);
    if (watchedAircraftId) {
      const selectedAircraftDetails = aircraft.find(a => a.id === watchedAircraftId);
      if (selectedAircraftDetails) {
        const isInsuranceExpired = selectedAircraftDetails.insurance_expiry_date && isValid(parseISO(selectedAircraftDetails.insurance_expiry_date)) && isBefore(parseISO(selectedAircraftDetails.insurance_expiry_date), startOfDay(new Date()));
        if (selectedAircraftDetails.is_out_of_service) {
          setAircraftWarning(`La aeronave seleccionada (${selectedAircraftDetails.name}) está fuera de servicio.`);
        } else if (isInsuranceExpired) {
          setAircraftWarning(`El seguro de la aeronave seleccionada (${selectedAircraftDetails.name}) está vencido.`);
        }
      }
    }
  }, [watchedAircraftId, aircraft]);

  useEffect(() => {
    let newMedicalWarningInfo: MedicalWarningState | null = null;
    const currentPilotDetails = pilots.find(p => p.id === watchedPilotId);
    const formFlightDate = watchedDate;

    if (open && watchedPilotId && currentPilotDetails?.medical_expiry && isValid(formFlightDate)) {
      const medicalExpiryDate = parseISO(currentPilotDetails.medical_expiry);

      if (isValid(medicalExpiryDate)) {
        const today = startOfDay(new Date());
        const normalizedFormFlightDate = startOfDay(formFlightDate);
        const normalizedMedicalExpiryDate = startOfDay(medicalExpiryDate);

        const isExpiredOnFlightDate = isBefore(normalizedMedicalExpiryDate, normalizedFormFlightDate);

        if (isExpiredOnFlightDate) {
          newMedicalWarningInfo = {
            show: true,
            title: "¡Psicofísico Vencido para esta Fecha!",
            message: `El psicofísico de ${currentPilotDetails.first_name} ${currentPilotDetails.last_name} VENCÍO el ${format(normalizedMedicalExpiryDate, 'dd/MM/yyyy', { locale: es })}. No puede ser asignado.`,
            variant: 'destructive',
          };
        } else {
          const daysUntilExpiryFromToday = differenceInDays(normalizedMedicalExpiryDate, today);
          if (daysUntilExpiryFromToday < 0) {
            newMedicalWarningInfo = {
              show: true,
              title: "¡Psicofísico Vencido!",
              message: `El psicofísico de ${currentPilotDetails.first_name} ${currentPilotDetails.last_name} VENCÍO el ${format(normalizedMedicalExpiryDate, 'dd/MM/yyyy', { locale: es })}. Revise la fecha del turno.`,
              variant: 'default',
              displayType: 'critical_non_blocking',
            };
          } else if (daysUntilExpiryFromToday <= 30) {
            newMedicalWarningInfo = {
              show: true,
              title: "¡Psicofísico Vence en Muy Poco Tiempo!",
              message: `El psicofísico de ${currentPilotDetails.first_name} ${currentPilotDetails.last_name} vence en ${daysUntilExpiryFromToday} día(s) (el ${format(normalizedMedicalExpiryDate, 'dd/MM/yyyy', { locale: es })}).`,
              variant: 'default',
              displayType: 'critical_non_blocking',
            };
          } else if (daysUntilExpiryFromToday <= 60) {
            newMedicalWarningInfo = {
              show: true,
              title: "Advertencia de Psicofísico",
              message: `El psicofísico de ${currentPilotDetails.first_name} ${currentPilotDetails.last_name} vence en ${daysUntilExpiryFromToday} día(s) (el ${format(normalizedMedicalExpiryDate, 'dd/MM/yyyy', { locale: es })}).`,
              variant: 'default',
              displayType: 'warning_non_blocking',
            };
          }
        }
      }
    }
    setMedicalWarning(newMedicalWarningInfo);
  }, [watchedPilotId, watchedDate, open, pilots]);

  // Effect for auto-selecting flight type based on pilot category
 useEffect(() => {
    const categoryForTurnDetails = categories.find(c => c.id === watchedPilotCategoryId);
    const normalizedCategoryForTurn = normalizeCategoryName(categoryForTurnDetails?.name);
    const instructionGivenFlightType = FLIGHT_TYPES.find(ft => ft.id === 'instruction_given');
    const towageFlightType = FLIGHT_TYPES.find(ft => ft.id === 'towage');

    if (!instructionGivenFlightType || !towageFlightType) return;

    if (normalizedCategoryForTurn === NORMALIZED_INSTRUCTOR_AVION || normalizedCategoryForTurn === NORMALIZED_INSTRUCTOR_PLANEADOR) {
      form.setValue('flight_type_id', instructionGivenFlightType.id, { shouldValidate: true, shouldDirty: true });
    } 
    else if (normalizedCategoryForTurn === NORMALIZED_REMOLCADOR) {
      form.setValue('flight_type_id', towageFlightType.id, { shouldValidate: true, shouldDirty: true });
    } 
    else {
      const previousFlightTypeId = form.getValues('flight_type_id');
      if (previousFlightTypeId === instructionGivenFlightType.id || previousFlightTypeId === towageFlightType.id) {
          let wasPreviouslyInstructorOrTow = false;
          if (entry?.pilot_category_id) {
              const prevCatDetails = categories.find(c => c.id === entry.pilot_category_id);
              const normalizedPrevCat = normalizeCategoryName(prevCatDetails?.name);
              if (normalizedPrevCat === NORMALIZED_INSTRUCTOR_AVION || 
                  normalizedPrevCat === NORMALIZED_INSTRUCTOR_PLANEADOR ||
                  normalizedPrevCat === NORMALIZED_REMOLCADOR) {
                  wasPreviouslyInstructorOrTow = true;
              }
          }
          if (wasPreviouslyInstructorOrTow || !entry) {
              form.setValue('flight_type_id', '', { shouldValidate: true, shouldDirty: true });
          }
      }
    }
  }, [watchedPilotCategoryId, categories, form, entry?.pilot_category_id]);


  useEffect(() => {
    setBookingConflictWarning(null);

    const formAircraftIdValue = form.getValues('aircraft_id');
    const formStartTimeValue = form.getValues('start_time');
    const formDateValue = form.getValues('date');

    if (!formAircraftIdValue || !formStartTimeValue || !formDateValue || !aircraft.length || !existingEntries?.length) {
      return;
    }
    
    const selectedAircraftDetails = aircraft.find(a => a.id === formAircraftIdValue);
    if (!selectedAircraftDetails) return;

    const dateString = format(formDateValue, 'yyyy-MM-dd');
    const formStartTimeHHMM = formStartTimeValue.substring(0, 5);

    const conflictingEntry = existingEntries.find(
      (se) =>
        se.date === dateString &&
        se.start_time.substring(0, 5) === formStartTimeHHMM &&
        se.aircraft_id === formAircraftIdValue &&
        (!entry || se.id !== entry.id) 
    );
    
    if (conflictingEntry) {
        // --- NEW SIMPLIFIED CONFLICT LOGIC ---
        // A conflict is ignorable if either the current booking or the existing one is for an instructor giving instruction.
        
        // 1. Check current form data
        const currentPilotCategoryId = form.getValues('pilot_category_id');
        const currentFlightTypeId = form.getValues('flight_type_id');
        const currentCategoryDetails = categories.find(c => c.id === currentPilotCategoryId);
        const currentNormalizedCategory = normalizeCategoryName(currentCategoryDetails?.name);
        
        const currentIsInstructorGivingInstruction =
            (currentNormalizedCategory === NORMALIZED_INSTRUCTOR_AVION || currentNormalizedCategory === NORMALIZED_INSTRUCTOR_PLANEADOR) &&
            currentFlightTypeId === 'instruction_given';

        // 2. Check existing conflicting entry data
        const conflictingCategoryDetails = categories.find(c => c.id === conflictingEntry.pilot_category_id);
        const conflictingNormalizedCategory = normalizeCategoryName(conflictingCategoryDetails?.name);
        
        const conflictingIsInstructorGivingInstruction =
            (conflictingNormalizedCategory === NORMALIZED_INSTRUCTOR_AVION || conflictingNormalizedCategory === NORMALIZED_INSTRUCTOR_PLANEADOR) &&
            conflictingEntry.flight_type_id === 'instruction_given';

        // 3. Determine if conflict should be ignored
        const isConflictIgnorable = currentIsInstructorGivingInstruction || conflictingIsInstructorGivingInstruction;

        if (isConflictIgnorable) {
          setBookingConflictWarning(null); // It's an instruction scenario, so no warning.
        } else {
          // It's a real conflict. Show the warning.
          const aircraftTypeName =
            selectedAircraftDetails.type === 'Glider' ? 'planeador' :
            selectedAircraftDetails.type === 'Tow Plane' ? 'avión remolcador' :
            'avión';
          const conflictingPilotName = getPilotName(conflictingEntry.pilot_id);
          setBookingConflictWarning({
            show: true,
            message: `El ${aircraftTypeName} ${selectedAircraftDetails.name} ya está reservado para las ${formStartTimeHHMM} en esta fecha por ${conflictingPilotName}.`,
          });
        }
    } else {
      setBookingConflictWarning(null); // No conflict found
    }
  }, [watchedAircraftId, watchedStartTime, watchedDate, watchedFlightTypeId, watchedPilotCategoryId, aircraft, existingEntries, entry, categories, getPilotName, form]);

  useEffect(() => {
    setSportFlightAircraftWarning(null);
    const formAircraftIdValue = form.getValues('aircraft_id');
    const formDateValue = form.getValues('date');
    const currentFlightTypeIdForTurn = form.getValues('flight_type_id');

    if (!formAircraftIdValue || !formDateValue || !aircraft.length || !existingEntries?.length) {
      return;
    }
    const dateString = format(formDateValue, 'yyyy-MM-dd');
    const sportFlightType = FLIGHT_TYPES.find(ft => ft.id === 'sport');

    if (sportFlightType) {
      const conflictingSportEntry = existingEntries.find(se =>
        se.date === dateString &&
        se.aircraft_id === formAircraftIdValue &&
        se.flight_type_id === sportFlightType.id &&
        (!entry || se.id !== entry.id) 
      );

      if (conflictingSportEntry) {
        const aircraftDetails = aircraft.find(a => a.id === formAircraftIdValue);
        const sportPilot = pilots.find(p => p.id === conflictingSportEntry.pilot_id);
        const sportPilotName = sportPilot ? `${sportPilot.first_name} ${sportPilot.last_name}` : 'Otro piloto';

        if (currentFlightTypeIdForTurn !== sportFlightType.id) { 
            setSportFlightAircraftWarning({
              show: true,
              message: `Supeditado a que finalice o se cancele el vuelo deportivo reservado para ${aircraftDetails?.name || 'esta aeronave'} por ${sportPilotName} a las ${conflictingSportEntry.start_time.substring(0,5)}.`,
              variant: 'info'
            });
        } else { 
           setSportFlightAircraftWarning(null);
        }
      } else {
        setSportFlightAircraftWarning(null);
      }
    } else {
       setSportFlightAircraftWarning(null);
    }
  }, [form, watchedAircraftId, watchedDate, watchedFlightTypeId, aircraft, existingEntries, entry, pilots]);


  const filteredAircraftForSelect = useMemo(() => {
    const currentFlightTypeId = form.getValues('flight_type_id');
    const towageFlightType = FLIGHT_TYPES.find(ft => ft.id === 'towage');
    const isFlightTypeRemolque = currentFlightTypeId === towageFlightType?.id;

    const availableAircraft = aircraft; // Show all aircraft regardless of service status

    if (isRemolcadorCategorySelectedForTurn || isFlightTypeRemolque) {
      return availableAircraft.filter(ac => ac.type === 'Tow Plane');
    }
    return availableAircraft;
  }, [isRemolcadorCategorySelectedForTurn, aircraft, form]);


  useEffect(() => {
    const currentAircraftId = form.getValues('aircraft_id');
    if (currentAircraftId) {
      const isCurrentAircraftInFilteredList = filteredAircraftForSelect.some(ac => ac.id === currentAircraftId);
      if (!isCurrentAircraftInFilteredList) {
        form.setValue('aircraft_id', '', { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [filteredAircraftForSelect, form]);


  const handleSubmit = (data: AvailabilityFormData) => {
    if ((medicalWarning && medicalWarning.variant === 'destructive' && medicalWarning.show) || (bookingConflictWarning && bookingConflictWarning.show)) {
        return;
    }

    let authUserIdToSet: string | null = null;
    if (!entry && currentUser) {
        authUserIdToSet = currentUser.id;
    } else if (entry && entry.auth_user_id) {
        authUserIdToSet = entry.auth_user_id;
    }

    const categoryForTurn = categories.find(c => c.id === data.pilot_category_id);
    const isCategoryForTurnActuallyRemolcador = normalizeCategoryName(categoryForTurn?.name) === NORMALIZED_REMOLCADOR;

    const dataToSubmit: Omit<ScheduleEntry, 'id' | 'created_at'> = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        aircraft_id: data.aircraft_id || null,
        is_tow_pilot_available: isCategoryForTurnActuallyRemolcador ? data.is_tow_pilot_available : false,
        auth_user_id: authUserIdToSet,
    };
    onSubmit(dataToSubmit, entry?.id);
    onOpenChange(false);
  };

  useEffect(() => {
    if (watchedPilotId && pilotDetails && form.getValues('pilot_category_id') && !pilotDetails.category_ids.includes(form.getValues('pilot_category_id'))) {
      form.setValue('pilot_category_id', '');
    }
    if (!watchedPilotId) {
        form.setValue('pilot_category_id', '');
    }
  }, [watchedPilotId, pilotDetails, form]);

  useEffect(() => {
    const categoryForTurn = categories.find(c => c.id === watchedPilotCategoryId);
    if (normalizeCategoryName(categoryForTurn?.name) !== NORMALIZED_REMOLCADOR) {
      if (form.getValues('is_tow_pilot_available') === true) {
        form.setValue('is_tow_pilot_available', false, { shouldValidate: true });
      }
    }
  }, [watchedPilotCategoryId, categories, form]);


  const sortedAndFilteredPilots = useMemo(() => {
    const searchTermLower = pilotSearchTerm.toLowerCase();
    return pilots
      .filter(p =>
        p.last_name.toLowerCase().includes(searchTermLower) ||
        p.first_name.toLowerCase().includes(searchTermLower)
      )
      .sort((a, b) => {
        const lastNameComparison = a.last_name.localeCompare(b.last_name, 'es', { sensitivity: 'base' });
        if (lastNameComparison !== 0) {
          return lastNameComparison;
        }
        return a.first_name.localeCompare(b.first_name, 'es', { sensitivity: 'base' });
      });
  }, [pilots, pilotSearchTerm]);

  const disablePilotSelection = !entry && !!currentUserLinkedPilotId && !currentUser?.is_admin;
  
  const isSubmitDisabled = useMemo(() => {
    const isMedicalBlocker = medicalWarning?.show && medicalWarning.variant === 'destructive';
    const isBookingBlocker = bookingConflictWarning?.show;
    const isAircraftBlocker = !!aircraftWarning;
    return isMedicalBlocker || isBookingBlocker || isAircraftBlocker;
  }, [medicalWarning, bookingConflictWarning, aircraftWarning]);


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
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Fecha</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
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
                        onSelect={(date) => {
                            if (date) field.onChange(date);
                            setIsCalendarOpen(false);
                        }}
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
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Hora Inicial</FormLabel>
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
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block self-start">Piloto</FormLabel>
                  <Popover open={pilotPopoverOpen} onOpenChange={setPilotPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={pilotPopoverOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={disablePilotSelection}
                        >
                          {field.value && pilots.find(p => p.id === field.value)
                            ? `${pilots.find(p => p.id === field.value)?.last_name}, ${pilots.find(p => p.id === field.value)?.first_name}`
                            : "Seleccionar piloto"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                     {!disablePilotSelection && (
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                            <CommandInput
                            placeholder="Buscar piloto..."
                            value={pilotSearchTerm}
                            onValueChange={setPilotSearchTerm}
                            />
                            <CommandList>
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                            <CommandGroup>
                                {sortedAndFilteredPilots.map((pilot) => (
                                <CommandItem
                                    value={`${pilot.last_name}, ${pilot.first_name} (${pilot.id})`}
                                    key={pilot.id}
                                    onSelect={() => {
                                    form.setValue("pilot_id", pilot.id, { shouldValidate: true, shouldDirty: true });
                                    setPilotPopoverOpen(false);
                                    setPilotSearchTerm('');
                                    }}
                                >
                                    <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        pilot.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                    />
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

            {medicalWarning && medicalWarning.show && (
              <Alert
                variant={medicalWarning.variant}
                className={cn(
                  medicalWarning.variant === 'default' && medicalWarning.displayType === 'warning_non_blocking' && "border-yellow-500",
                  medicalWarning.variant === 'default' && medicalWarning.displayType === 'critical_non_blocking' && "border-red-500"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    medicalWarning.variant === 'default' && medicalWarning.displayType === 'warning_non_blocking' && "text-yellow-500",
                    medicalWarning.variant === 'default' && medicalWarning.displayType === 'critical_non_blocking' && "text-red-500"
                  )}
                />
                <AlertTitle
                  className={cn(
                    medicalWarning.variant === 'default' && medicalWarning.displayType === 'critical_non_blocking' && "text-red-700"
                  )}
                >
                  {medicalWarning.title}
                </AlertTitle>
                <AlertDescription
                  className={cn(
                    medicalWarning.variant === 'default' && medicalWarning.displayType === 'critical_non_blocking' && "text-red-700/90"
                  )}
                >
                  {medicalWarning.message}
                </AlertDescription>
              </Alert>
            )}

            {watchedPilotId && (
               <FormField
                control={form.control}
                name="pilot_category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">
                        Categoría del Piloto para este Turno
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger disabled={!pilotDetails || pilotCategoriesForSelectedPilot.length === 0}>
                          <SelectValue placeholder={pilotCategoriesForSelectedPilot.length > 0 ? "Seleccionar categoría del piloto" : "Piloto no tiene categorías"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pilotCategoriesForSelectedPilot.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                             {cat.name}
                          </SelectItem>
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
                      <FormDescription>
                        Marque si está disponible para remolcar en este horario.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
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
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Tipo de Vuelo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo de vuelo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FLIGHT_TYPES.map(ft => (
                        <SelectItem key={ft.id} value={ft.id} disabled={isRemolcadorCategorySelectedForTurn && ft.id !== 'towage'}>
                          {ft.name}
                        </SelectItem>
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
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Aeronave</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value)}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar aeronave" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredAircraftForSelect.length > 0 ? (
                        filteredAircraftForSelect.map(ac => {
                          const isInsuranceExpired = ac.insurance_expiry_date && isValid(parseISO(ac.insurance_expiry_date)) && isBefore(parseISO(ac.insurance_expiry_date), startOfDay(new Date()));
                          const isEffectivelyOutOfService = ac.is_out_of_service || isInsuranceExpired;
                          let outOfServiceReason = "";
                          if (ac.is_out_of_service) {
                            outOfServiceReason = "(Fuera de Servicio)";
                          } else if (isInsuranceExpired) {
                            outOfServiceReason = "(Seguro Vencido)";
                          }
                          
                          return (
                            <SelectItem key={ac.id} value={ac.id} disabled={isEffectivelyOutOfService}>
                              {ac.name} ({ac.type === 'Glider' ? 'Planeador' :
                                                                                        ac.type === 'Tow Plane' ? 'Remolcador' : 'Avión'})
                              {isEffectivelyOutOfService && ` ${outOfServiceReason}`}
                            </SelectItem>
                          )
                        })
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">No hay aeronaves que coincidan.</div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {aircraftWarning && (
                <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Aeronave no disponible</AlertTitle>
                    <AlertDescription>{aircraftWarning}</AlertDescription>
                </Alert>
            )}
             {bookingConflictWarning && bookingConflictWarning.show && (
              <Alert variant="destructive" className="mt-2">
                <PlaneIconLucide className="h-4 w-4" />
                <AlertTitle>Conflicto de Reserva</AlertTitle>
                <AlertDescription>{bookingConflictWarning.message}</AlertDescription>
              </Alert>
            )}
            {sportFlightAircraftWarning && sportFlightAircraftWarning.show && (
                 <Alert variant="default" className={cn(
                    "mt-2",
                    sportFlightAircraftWarning.variant === 'info'
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-orange-400 bg-orange-50 text-orange-700" 
                )}>
                    <AlertTriangle className={cn("h-4 w-4",
                         sportFlightAircraftWarning.variant === 'info' ? "text-blue-500" : "text-orange-500"
                    )} />
                    <AlertTitle className={cn(
                        sportFlightAircraftWarning.variant === 'info' ? "text-blue-700" : "text-orange-700"
                    )}>
                        {sportFlightAircraftWarning.variant === 'info' ? "Información de Reserva" : "Advertencia de Vuelo Deportivo"}
                    </AlertTitle>
                    <AlertDescription className={cn(
                         sportFlightAircraftWarning.variant === 'info' ? "text-blue-700/90" : "text-orange-700/90"
                    )}>{sportFlightAircraftWarning.message}</AlertDescription>
                </Alert>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => {
                onOpenChange(false);
                }}>Cancelar</Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
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
