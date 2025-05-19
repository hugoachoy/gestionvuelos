
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
import { useState, useEffect } from 'react';

const pilotSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio."),
  lastName: z.string().min(1, "El apellido es obligatorio."),
  categoryIds: z.array(z.string()).min(1, "Seleccione al menos una categoría."),
  medicalExpiry: z.date({ 
      required_error: "La fecha de vencimiento del psicofísico es obligatoria.",
      invalid_type_error: "Fecha inválida." 
    })
    .refine(date => date >= new Date(new Date().setHours(0,0,0,0)), { 
      message: "La fecha de vencimiento no puede ser en el pasado." 
    }),
});

type PilotFormData = z.infer<typeof pilotSchema>;

interface PilotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PilotFormData, pilotId?: string) => void;
  pilot?: Pilot;
  categories: PilotCategory[];
}

export function PilotForm({ open, onOpenChange, onSubmit, pilot, categories }: PilotFormProps) {
  const form = useForm<PilotFormData>({
    resolver: zodResolver(pilotSchema),
    defaultValues: pilot
      ? { ...pilot, medicalExpiry: pilot.medicalExpiry ? parseISO(pilot.medicalExpiry) : new Date() }
      : { firstName: '', lastName: '', categoryIds: [], medicalExpiry: new Date() },
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // Local state for the date input string
  const [medicalExpiryDateString, setMedicalExpiryDateString] = useState('');

  // Sync react-hook-form field value with local dateString state
  useEffect(() => {
    const medicalExpiryValue = form.getValues('medicalExpiry');
    if (medicalExpiryValue && isValid(medicalExpiryValue)) {
      setMedicalExpiryDateString(format(medicalExpiryValue, "dd/MM/yyyy", { locale: es }));
    } else if (pilot?.medicalExpiry) {
      // if form value is not set yet, but pilot data exists
      const parsedDate = parseISO(pilot.medicalExpiry);
      if (isValid(parsedDate)) {
         setMedicalExpiryDateString(format(parsedDate, "dd/MM/yyyy", { locale: es }));
      } else {
        setMedicalExpiryDateString('');
      }
    } 
     else {
      // For new pilot, if default is new Date()
       const defaultDate = new Date();
        setMedicalExpiryDateString(format(defaultDate, "dd/MM/yyyy", { locale: es }));
         if (!form.getValues('medicalExpiry')) { // Set default if not already set
            form.setValue('medicalExpiry', defaultDate, {shouldValidate: true});
        }
    }
  }, [form, form.getValues('medicalExpiry'), pilot]);


  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (date: Date | undefined) => void) => {
    const textValue = e.target.value;
    setMedicalExpiryDateString(textValue);
    const parsedDate = parse(textValue, "dd/MM/yyyy", new Date(), { locale: es });
    if (isValid(parsedDate)) {
      fieldOnChange(parsedDate);
    } else {
      // Pass undefined or an invalid marker if Zod should catch it as invalid_type_error
      // For now, let RHF handle validation based on schema.
      // If input is cleared or invalid, Zod rule should catch it.
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
    onSubmit(data, pilot?.id);
    form.reset({ 
        firstName: '', 
        lastName: '', 
        categoryIds: [], 
        medicalExpiry: new Date() // Reset to default after submit
    });
    setMedicalExpiryDateString(format(new Date(), "dd/MM/yyyy", { locale: es })); // Reset date string
    onOpenChange(false);
  };
  
  // Effect to reset date string when form is reset externally or pilot changes
  useEffect(() => {
    if (open) { // only run when dialog is open
        const currentMedicalDate = pilot 
            ? (pilot.medicalExpiry ? parseISO(pilot.medicalExpiry) : new Date())
            : new Date();
        if (isValid(currentMedicalDate)) {
            setMedicalExpiryDateString(format(currentMedicalDate, "dd/MM/yyyy", { locale: es }));
            form.setValue('medicalExpiry', currentMedicalDate, { shouldValidate: true, shouldDirty: !!pilot });
        } else {
             setMedicalExpiryDateString('');
             form.setValue('medicalExpiry', undefined as any, { shouldValidate: true, shouldDirty: !!pilot });
        }
    }
  }, [pilot, open, form.reset, form.setValue]);


  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            form.reset(pilot
              ? { ...pilot, medicalExpiry: pilot.medicalExpiry ? parseISO(pilot.medicalExpiry) : new Date() }
              : { firstName: '', lastName: '', categoryIds: [], medicalExpiry: new Date() }
            );
             // Reset date string based on defaultValues when dialog closes
            const defaultDateOnClose = pilot?.medicalExpiry ? parseISO(pilot.medicalExpiry) : new Date();
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
              name="firstName"
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
              name="lastName"
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
              name="categoryIds"
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
                            />
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
              name="medicalExpiry"
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
                          className={cn(!isValid(field.value) && form.formState.touchedFields.medicalExpiry && "border-destructive focus-visible:ring-destructive")}
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
                form.reset(pilot
                  ? { ...pilot, medicalExpiry: pilot.medicalExpiry ? parseISO(pilot.medicalExpiry) : new Date() }
                  : { firstName: '', lastName: '', categoryIds: [], medicalExpiry: new Date() }
                );
                const defaultDateOnCancel = pilot?.medicalExpiry ? parseISO(pilot.medicalExpiry) : new Date();
                setMedicalExpiryDateString(isValid(defaultDateOnCancel) ? format(defaultDateOnCancel, "dd/MM/yyyy", {locale: es}) : '');
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

