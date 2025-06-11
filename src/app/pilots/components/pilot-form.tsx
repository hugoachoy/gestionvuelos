
"use client";

import type { Pilot, PilotCategory } from '@/types';
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, parse, isValid, startOfDay, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { useAuth } from '@/contexts/AuthContext';

type PilotFormData = z.infer<ReturnType<typeof createPilotSchema>>;

// Function to create the schema dynamically based on the existing pilot's medical expiry
const createPilotSchema = (originalMedicalExpiryDateString?: string | null) => {
  const originalExpiryDate = originalMedicalExpiryDateString && isValid(parseISO(originalMedicalExpiryDateString)) 
    ? startOfDay(parseISO(originalMedicalExpiryDateString)) 
    : null;

  return z.object({
    first_name: z.string().min(1, "El nombre es obligatorio."),
    last_name: z.string().min(1, "El apellido es obligatorio."),
    category_ids: z.array(z.string()).min(1, "Seleccione al menos una categoría."),
    medical_expiry: z.date({
        required_error: "La fecha de vencimiento del psicofísico es obligatoria.",
        invalid_type_error: "Fecha inválida."
      })
      .refine(submittedDateObj => {
        const today = startOfDay(new Date());
        const submittedDate = startOfDay(submittedDateObj);

        if (originalExpiryDate) { // Editing existing pilot
          if (isBefore(originalExpiryDate, today)) { // Original was already expired
            // Valid if:
            // 1. Submitted date is the same as the (already past) original expiry date.
            // OR
            // 2. Submitted date is a new date that is in the future (or today).
            return submittedDate.getTime() === originalExpiryDate.getTime() || submittedDate >= today;
          } else { // Original was not expired (it was in the future)
            // Submitted date must be in the future (or today).
            return submittedDate >= today;
          }
        } else { // Creating new pilot
          // Submitted date must be in the future (or today).
          return submittedDate >= today;
        }
      }, {
        message: "La fecha de vencimiento no puede ser anterior a hoy. Si edita un piloto con psicofísico ya vencido, puede mantener la fecha vencida original o actualizarla a una fecha futura."
      }),
    is_admin: z.boolean().optional(),
  });
};


interface PilotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Pilot, 'id' | 'created_at'>, pilotId?: string) => void;
  pilot?: Pilot;
  categories: PilotCategory[];
  allowIsAdminChange?: boolean;
}

export function PilotForm({ open, onOpenChange, onSubmit, pilot, categories, allowIsAdminChange = false }: PilotFormProps) {
  const { user: currentUser } = useAuth();
  
  const pilotSchema = useMemo(() => createPilotSchema(pilot?.medical_expiry), [pilot?.medical_expiry]);

  const form = useForm<PilotFormData>({
    resolver: zodResolver(pilotSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      category_ids: [],
      medical_expiry: new Date(),
      is_admin: false, 
    },
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [medicalExpiryDateString, setMedicalExpiryDateString] = useState('');

  useEffect(() => {
    if (open) {
      const initialFormValues = pilot
        ? {
            first_name: pilot.first_name || '',
            last_name: pilot.last_name || '',
            category_ids: pilot.category_ids || [],
            medical_expiry: pilot.medical_expiry && isValid(parseISO(pilot.medical_expiry)) ? parseISO(pilot.medical_expiry) : new Date(),
            is_admin: pilot.is_admin ?? false, 
          }
        : {
            first_name: '',
            last_name: '',
            category_ids: [],
            medical_expiry: new Date(), // For new pilot, default to today
            is_admin: false,
          };
      form.reset(initialFormValues);
      
      // Update the schema in the resolver if pilot changes (specifically medical_expiry)
      // This is implicitly handled because zodResolver takes the schema which is memoized by pilot.medical_expiry
      // So when `pilot` changes, `pilotSchema` re-memoizes, and `form` instance uses the new schema for subsequent validations.

      const currentMedicalDateInForm = initialFormValues.medical_expiry;
      if (isValid(currentMedicalDateInForm)) {
        setMedicalExpiryDateString(format(currentMedicalDateInForm, "dd/MM/yyyy", { locale: es }));
      } else {
         // Fallback for new pilot or invalid date
        setMedicalExpiryDateString(format(initialFormValues.medical_expiry || new Date(), "dd/MM/yyyy", { locale: es }));
      }
    }
  }, [open, pilot, form, pilotSchema]); // Added pilotSchema to dependencies


  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (date: Date | undefined) => void) => {
    const textValue = e.target.value;
    setMedicalExpiryDateString(textValue);
    const parsedDate = parse(textValue, "dd/MM/yyyy", new Date(), { locale: es });
    if (isValid(parsedDate)) {
      fieldOnChange(parsedDate);
    } else {
      fieldOnChange(undefined); 
    }
  };

  const handleDateSelect = (date: Date | undefined, fieldOnChange: (date: Date | undefined) => void) => {
    if (date) {
      fieldOnChange(date);
      setMedicalExpiryDateString(format(date, "dd/MM/yyyy", { locale: es }));
    } else {
      fieldOnChange(undefined);
      setMedicalExpiryDateString('');
    }
    setIsCalendarOpen(false);
  };

  const handleSubmit = (data: PilotFormData) => {
    const dataToSubmit: Omit<Pilot, 'id' | 'created_at'> = {
        ...data,
        medical_expiry: format(data.medical_expiry, 'yyyy-MM-dd'),
        is_admin: data.is_admin ?? false, 
        auth_user_id: pilot?.auth_user_id 
    };
    onSubmit(dataToSubmit, pilot?.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[425px] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pilot ? 'Editar Piloto' : 'Agregar Piloto'}</DialogTitle>
          <DialogDescription>
            {pilot ? 'Modifica los detalles del piloto.' : 'Ingresa los detalles del nuevo piloto.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellido</FormLabel>
                  <FormControl>
                    <Input placeholder="Perez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categorías</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value?.length && "text-muted-foreground"
                          )}
                        >
                          {field.value?.length
                            ? field.value.map(id => categories.find(c => c.id === id)?.name).filter(Boolean).join(', ')
                            : "Seleccionar categorías"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <ScrollArea className="h-48">
                        {categories.map((category) => (
                          <FormItem
                            key={category.id}
                            className="flex flex-row items-center space-x-3 space-y-0 p-2 hover:bg-accent rounded-md"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(category.id)}
                                onCheckedChange={(checked) => {
                                  const currentCategoryIds = field.value || [];
                                  return checked
                                    ? field.onChange([...currentCategoryIds, category.id])
                                    : field.onChange(
                                        currentCategoryIds.filter(
                                          (value) => value !== category.id
                                        )
                                      );
                                }}
                                id={`category-${category.id}`}
                                aria-labelledby={`category-label-${category.id}`}
                              />
                            </FormControl>
                            <FormLabel
                              htmlFor={`category-${category.id}`} 
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                              id={`category-label-${category.id}`}
                            >
                              {category.name}
                            </FormLabel>
                          </FormItem>
                        ))}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medical_expiry"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Vencimiento Psicofísico (dd/MM/yyyy)</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <div className="flex items-center gap-2">
                       <FormControl>
                        <Input
                          type="text"
                          placeholder="dd/MM/yyyy"
                          value={medicalExpiryDateString}
                          onChange={(e) => handleDateInputChange(e, field.onChange)}
                          onFocus={() => setIsCalendarOpen(true)}
                          className={cn(!isValid(field.value) && form.formState.touchedFields.medical_expiry && "border-destructive focus-visible:ring-destructive")}
                        />
                      </FormControl>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" type="button" className="shrink-0">
                          <CalendarIcon className="h-4 w-4" />
                          <span className="sr-only">Abrir calendario</span>
                        </Button>
                      </PopoverTrigger>
                    </div>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value instanceof Date && isValid(field.value) ? field.value : undefined}
                        onSelect={(date) => handleDateSelect(date, field.onChange)}
                        // The disabled prop on Calendar itself only prevents user from picking via UI.
                        // Zod validation will handle the logic of what can be saved.
                        // Keeping this for UI convenience:
                        disabled={(date) =>
                          date < startOfDay(new Date()) && // Can't pick past date unless
                          !(pilot?.medical_expiry && startOfDay(parseISO(pilot.medical_expiry)).getTime() === startOfDay(date).getTime()) // it's the exact original past date
                        }
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  {pilot && !allowIsAdminChange && currentUser?.id !== pilot.auth_user_id && (
                    <FormDescription className="text-xs text-muted-foreground/80 mt-1">
                      Nota: Solo un administrador puede modificar este campo para otros pilotos.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {(allowIsAdminChange) && (
              <FormField
                control={form.control}
                name="is_admin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel htmlFor="is_admin_checkbox" id="is_admin_label">Administrador</FormLabel>
                      <FormDescription>
                        Permitir acceso administrativo al piloto.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        id="is_admin_checkbox"
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        aria-labelledby="is_admin_label"
                        disabled={!currentUser?.is_admin} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                onOpenChange(false);
              }}>Cancelar</Button>
              <Button type="submit">{pilot ? 'Guardar Cambios' : 'Crear Piloto'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

