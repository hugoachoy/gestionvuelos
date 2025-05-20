
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
import { format, parseISO, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useState, useEffect } from 'react';

// Schema uses snake_case matching the Type and DB
const pilotSchema = z.object({
  first_name: z.string().min(1, "El nombre es obligatorio."),
  last_name: z.string().min(1, "El apellido es obligatorio."),
  category_ids: z.array(z.string()).min(1, "Seleccione al menos una categoría."),
  medical_expiry: z.date({
      required_error: "La fecha de vencimiento del psicofísico es obligatoria.",
      invalid_type_error: "Fecha inválida."
    })
    .refine(date => date >= new Date(new Date().setHours(0,0,0,0)), {
      message: "La fecha de vencimiento no puede ser en el pasado."
    }),
});

// This FormData type will have snake_case fields
type PilotFormData = z.infer<typeof pilotSchema>;

interface PilotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Pilot, 'id' | 'created_at'>, pilotId?: string) => void;
  pilot?: Pilot; // Pilot type has snake_case fields
  categories: PilotCategory[];
}

export function PilotForm({ open, onOpenChange, onSubmit, pilot, categories }: PilotFormProps) {
  const form = useForm<PilotFormData>({
    resolver: zodResolver(pilotSchema),
    defaultValues: { // Initial defaults for a new pilot, or if pilot prop is initially undefined
      first_name: '',
      last_name: '',
      category_ids: [],
      medical_expiry: new Date(),
      ...(pilot && { // Spread pilot data if available initially (less common path for edit)
        ...pilot,
        medical_expiry: pilot.medical_expiry ? parseISO(pilot.medical_expiry) : new Date(),
      })
    },
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [medicalExpiryDateString, setMedicalExpiryDateString] = useState('');

  useEffect(() => {
    // This effect runs when the dialog opens or the pilot data changes.
    // It's responsible for resetting the form with the pilot's data or default new pilot data.
    if (open) {
      const initialFormValues = pilot
        ? {
            first_name: pilot.first_name || '', // Ensure string for form field
            last_name: pilot.last_name || '',   // Ensure string for form field
            category_ids: pilot.category_ids || [],
            medical_expiry: pilot.medical_expiry ? parseISO(pilot.medical_expiry) : new Date(),
          }
        : { // Default for new pilot
            first_name: '',
            last_name: '',
            category_ids: [],
            medical_expiry: new Date(),
          };
      form.reset(initialFormValues);

      // This part updates the medicalExpiryDateString for display purposes,
      // based on the date that was just set in the form via reset.
      const currentMedicalDateInForm = initialFormValues.medical_expiry;
      if (isValid(currentMedicalDateInForm)) {
        setMedicalExpiryDateString(format(currentMedicalDateInForm, "dd/MM/yyyy", { locale: es }));
      } else {
        // Fallback for display string if date somehow invalid (should be rare)
        setMedicalExpiryDateString(format(new Date(), "dd/MM/yyyy", { locale: es }));
      }
    }
  }, [open, pilot, form]);


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
    const dataToSubmit = {
        ...data,
        medical_expiry: format(data.medical_expiry, 'yyyy-MM-dd'),
    };
    onSubmit(dataToSubmit, pilot?.id);
    // form.reset is handled by onOpenChange and the useEffect for 'open' state
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            // Reset form to initial state when closing, respecting if a pilot was being edited or if it's for a new one
            const resetValuesOnClose = pilot
              ? {
                  first_name: pilot.first_name || '',
                  last_name: pilot.last_name || '',
                  category_ids: pilot.category_ids || [],
                  medical_expiry: pilot.medical_expiry ? parseISO(pilot.medical_expiry) : new Date()
                }
              : { first_name: '', last_name: '', category_ids: [], medical_expiry: new Date() };
            form.reset(resetValuesOnClose);
            const defaultDateOnClose = resetValuesOnClose.medical_expiry;
            setMedicalExpiryDateString(isValid(defaultDateOnClose) ? format(defaultDateOnClose, "dd/MM/yyyy", {locale: es}) : '');
        }
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
                          <div
                            key={category.id}
                            className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                            onClick={() => {
                              const currentCategoryIds = field.value || [];
                              const newCategoryIds = currentCategoryIds.includes(category.id)
                                ? currentCategoryIds.filter(id => id !== category.id)
                                : [...currentCategoryIds, category.id];
                              field.onChange(newCategoryIds);
                            }}
                          >
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
                              id={`category-${category.id}`} // Added id for label association
                            />
                            <label htmlFor={`category-${category.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                              {category.name}
                            </label>
                          </div>
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
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0,0,0,0))
                        }
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                // Reset logic handled by onOpenChange in Dialog prop
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
