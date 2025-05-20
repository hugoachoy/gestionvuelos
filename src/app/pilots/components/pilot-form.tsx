
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
    defaultValues: pilot
      ? { ...pilot, medical_expiry: pilot.medical_expiry ? parseISO(pilot.medical_expiry) : new Date() }
      : { first_name: '', last_name: '', category_ids: [], medical_expiry: new Date() },
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [medicalExpiryDateString, setMedicalExpiryDateString] = useState('');

  useEffect(() => {
    const medicalExpiryValue = form.getValues('medical_expiry');
    if (medicalExpiryValue && isValid(medicalExpiryValue)) {
      setMedicalExpiryDateString(format(medicalExpiryValue, "dd/MM/yyyy", { locale: es }));
    } else if (pilot?.medical_expiry) {
      const parsedDate = parseISO(pilot.medical_expiry);
      if (isValid(parsedDate)) {
         setMedicalExpiryDateString(format(parsedDate, "dd/MM/yyyy", { locale: es }));
      } else {
        setMedicalExpiryDateString('');
      }
    } else {
       const defaultDate = new Date();
        setMedicalExpiryDateString(format(defaultDate, "dd/MM/yyyy", { locale: es }));
         if (!form.getValues('medical_expiry')) { 
            form.setValue('medical_expiry', defaultDate, {shouldValidate: true});
        }
    }
  }, [form, pilot]); // Simplified dependencies

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
    // Convert medical_expiry back to string for submission if needed by the hook, or let hook handle it
    const dataToSubmit = {
        ...data,
        medical_expiry: format(data.medical_expiry, 'yyyy-MM-dd'), // Ensure string format for DB
    };
    onSubmit(dataToSubmit, pilot?.id);
    form.reset({ 
        first_name: '', 
        last_name: '', 
        category_ids: [], 
        medical_expiry: new Date()
    });
    setMedicalExpiryDateString(format(new Date(), "dd/MM/yyyy", { locale: es }));
    onOpenChange(false);
  };
  
  useEffect(() => {
    if (open) {
        const currentMedicalDate = pilot 
            ? (pilot.medical_expiry ? parseISO(pilot.medical_expiry) : new Date())
            : new Date();
        if (isValid(currentMedicalDate)) {
            setMedicalExpiryDateString(format(currentMedicalDate, "dd/MM/yyyy", { locale: es }));
            form.setValue('medical_expiry', currentMedicalDate, { shouldValidate: true, shouldDirty: !!pilot });
        } else {
             setMedicalExpiryDateString('');
             form.setValue('medical_expiry', undefined as any, { shouldValidate: true, shouldDirty: !!pilot });
        }
    }
  }, [pilot, open, form]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            form.reset(pilot
              ? { ...pilot, medical_expiry: pilot.medical_expiry ? parseISO(pilot.medical_expiry) : new Date() }
              : { first_name: '', last_name: '', category_ids: [], medical_expiry: new Date() }
            );
            const defaultDateOnClose = pilot?.medical_expiry ? parseISO(pilot.medical_expiry) : new Date();
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
                form.reset(pilot
                  ? { ...pilot, medical_expiry: pilot.medical_expiry ? parseISO(pilot.medical_expiry) : new Date() }
                  : { first_name: '', last_name: '', category_ids: [], medical_expiry: new Date() }
                );
                const defaultDateOnCancel = pilot?.medical_expiry ? parseISO(pilot.medical_expiry) : new Date();
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
