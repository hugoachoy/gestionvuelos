
"use client";

import type { Aircraft } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const aircraftSchema = z.object({
  name: z.string().min(1, "El nombre/matrícula es obligatorio."),
  type: z.enum(['Tow Plane', 'Glider', 'Avión'], { required_error: "El tipo de aeronave es obligatorio." }),
  is_out_of_service: z.boolean().default(false),
  out_of_service_reason: z.string().nullable().optional(),
  annual_review_date: z.date().nullable().optional(),
  last_oil_change_date: z.date().nullable().optional(),
  insurance_expiry_date: z.date().nullable().optional(),
});

type AircraftFormData = z.infer<typeof aircraftSchema>;

interface AircraftFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Aircraft, 'id' | 'created_at'>, aircraftId?: string) => void;
  aircraft?: Aircraft;
}

export function AircraftForm({ open, onOpenChange, onSubmit, aircraft }: AircraftFormProps) {
  const [isAnnualPickerOpen, setAnnualPickerOpen] = useState(false);
  const [isOilPickerOpen, setOilPickerOpen] = useState(false);
  const [isInsurancePickerOpen, setInsurancePickerOpen] = useState(false);

  const form = useForm<AircraftFormData>({
    resolver: zodResolver(aircraftSchema),
    defaultValues: {
      name: '',
      type: undefined,
      is_out_of_service: false,
      out_of_service_reason: null,
      annual_review_date: null,
      last_oil_change_date: null,
      insurance_expiry_date: null,
    },
  });

  const watchedIsOutOfService = form.watch('is_out_of_service');
  const watchedAircraftType = form.watch('type');
  const watchedInsuranceExpiry = form.watch('insurance_expiry_date');
  const watchedAnnualReview = form.watch('annual_review_date');

  // Automatically re-enable aircraft if relevant dates are updated to be valid
  React.useEffect(() => {
    const isOutOfService = form.getValues('is_out_of_service');
    const reason = form.getValues('out_of_service_reason');
    
    const insuranceIsNowValid = watchedInsuranceExpiry && isValid(watchedInsuranceExpiry) && !isBefore(watchedInsuranceExpiry, startOfDay(new Date()));
    const annualIsNowValid = watchedAnnualReview && isValid(watchedAnnualReview) && !isBefore(watchedAnnualReview, startOfDay(new Date()));

    // Check if it was out of service specifically due to insurance or annual review
    if (isOutOfService && (reason?.toLowerCase().includes('seguro') || reason?.toLowerCase().includes('anual'))) {
        if (reason?.toLowerCase().includes('seguro') && insuranceIsNowValid) {
            if (annualIsNowValid || !watchedAnnualReview) { 
                 form.setValue('is_out_of_service', false, { shouldValidate: true });
                 form.setValue('out_of_service_reason', null, { shouldValidate: true });
            }
        }
        if (reason?.toLowerCase().includes('anual') && annualIsNowValid) {
            if (insuranceIsNowValid || !watchedInsuranceExpiry) {
                form.setValue('is_out_of_service', false, { shouldValidate: true });
                form.setValue('out_of_service_reason', null, { shouldValidate: true });
            }
        }
    }
  }, [watchedInsuranceExpiry, watchedAnnualReview, form]);

  const handleSubmit = (data: AircraftFormData) => {
    const dataToSubmit: Omit<Aircraft, 'id' | 'created_at'> = {
      ...data,
      annual_review_date: data.annual_review_date ? format(data.annual_review_date, 'yyyy-MM-dd') : null,
      last_oil_change_date: data.last_oil_change_date ? format(data.last_oil_change_date, 'yyyy-MM-dd') : null,
      insurance_expiry_date: data.insurance_expiry_date ? format(data.insurance_expiry_date, 'yyyy-MM-dd') : null,
      out_of_service_reason: data.is_out_of_service ? data.out_of_service_reason : null,
    };
    onSubmit(dataToSubmit, aircraft?.id);
    form.reset();
  };

  React.useEffect(() => {
    if (open) {
      const defaultValues = aircraft
        ? {
            name: aircraft.name,
            type: aircraft.type,
            is_out_of_service: aircraft.is_out_of_service ?? false,
            out_of_service_reason: aircraft.out_of_service_reason,
            annual_review_date: aircraft.annual_review_date && isValid(parseISO(aircraft.annual_review_date)) ? parseISO(aircraft.annual_review_date) : null,
            last_oil_change_date: aircraft.last_oil_change_date && isValid(parseISO(aircraft.last_oil_change_date)) ? parseISO(aircraft.last_oil_change_date) : null,
            insurance_expiry_date: aircraft.insurance_expiry_date && isValid(parseISO(aircraft.insurance_expiry_date)) ? parseISO(aircraft.insurance_expiry_date) : null,
          }
        : {
            name: '',
            type: undefined,
            is_out_of_service: false,
            out_of_service_reason: null,
            annual_review_date: null,
            last_oil_change_date: null,
            insurance_expiry_date: null,
          };
      form.reset(defaultValues);

      if (aircraft && !aircraft.is_out_of_service) {
          const insuranceDate = defaultValues.insurance_expiry_date;
          if (insuranceDate && isValid(insuranceDate) && isBefore(insuranceDate, startOfDay(new Date()))) {
              form.setValue('is_out_of_service', true);
              form.setValue('out_of_service_reason', 'Seguro vencido');
          }
          const annualDate = defaultValues.annual_review_date;
           if (annualDate && isValid(annualDate) && isBefore(annualDate, startOfDay(new Date()))) {
              form.setValue('is_out_of_service', true);
              form.setValue('out_of_service_reason', 'Revisión Anual vencida');
          }
      }
    }
  }, [open, aircraft, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{aircraft ? 'Editar Aeronave' : 'Agregar Aeronave'}</DialogTitle>
          <DialogDescription>
            {aircraft ? 'Modifica los detalles de la aeronave.' : 'Ingresa los detalles de la nueva aeronave.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Nombre/Matrícula</FormLabel>
                  <FormControl>
                    <Input placeholder="LV-ABC" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Tipo de Aeronave</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Tow Plane">Avión Remolcador</SelectItem>
                      <SelectItem value="Glider">Planeador</SelectItem>
                      <SelectItem value="Avión">Avión</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="annual_review_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Fecha de Revisión Anual</FormLabel>
                  <Popover open={isAnnualPickerOpen} onOpenChange={setAnnualPickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => { field.onChange(date); setAnnualPickerOpen(false); }}
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
              name="insurance_expiry_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Fecha Vencimiento Seguro</FormLabel>
                  <Popover open={isInsurancePickerOpen} onOpenChange={setInsurancePickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => { field.onChange(date); setInsurancePickerOpen(false); }}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
             {watchedAircraftType !== 'Glider' && (
              <>
                <FormField
                  control={form.control}
                  name="last_oil_change_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Fecha de Último Cambio de Aceite</FormLabel>
                      <Popover open={isOilPickerOpen} onOpenChange={setOilPickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => { field.onChange(date); setOilPickerOpen(false); }}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription className="text-xs">
                        Esta fecha reinicia el contador de horas y el total de aceite agregado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField
              control={form.control}
              name="is_out_of_service"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      ¿Fuera de Servicio?
                    </FormLabel>
                    <FormDescription>
                      Marque si la aeronave no está operativa.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            {watchedIsOutOfService && (
              <FormField
                control={form.control}
                name="out_of_service_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="bg-primary text-primary-foreground rounded-md px-2 py-1 inline-block">Motivo de Fuera de Servicio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describa el motivo por el cual la aeronave está fuera de servicio..."
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => { form.reset(); onOpenChange(false); }}>Cancelar</Button>
              <Button type="submit">{aircraft ? 'Guardar Cambios' : 'Crear Aeronave'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
