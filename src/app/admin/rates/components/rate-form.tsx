
"use client";

import type { Rate } from '@/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import React from 'react';

const rateSchema = z.object({
  item_name: z.string().min(3, "El nombre del ítem es obligatorio y debe tener al menos 3 caracteres."),
  is_percentage: z.boolean().default(false),
  percentage_value: z.coerce.number().min(0, "El porcentaje debe ser un número positivo.").optional().nullable(),
  member_price: z.coerce.number().min(0, "El precio debe ser un número positivo.").optional().nullable(),
  non_member_price: z.coerce.number().min(0, "El precio debe ser un número positivo.").optional().nullable(),
  pos_member_price: z.coerce.number().min(0, "El precio debe ser un número positivo.").optional().nullable(),
  pos_non_member_price: z.coerce.number().min(0, "El precio debe ser un número positivo.").optional().nullable(),
}).refine(data => {
  if (data.is_percentage) {
    return data.percentage_value !== null && data.percentage_value !== undefined && data.percentage_value > 0;
  }
  return true;
}, {
  message: "Debe ingresar un valor de porcentaje si la casilla está marcada.",
  path: ["percentage_value"],
});


type RateFormData = z.infer<typeof rateSchema>;

interface RateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Rate, 'id' | 'created_at'>, rateId?: string) => void;
  rate?: Rate;
}

export function RateForm({ open, onOpenChange, onSubmit, rate }: RateFormProps) {
  const form = useForm<RateFormData>({
    resolver: zodResolver(rateSchema),
    defaultValues: {
      item_name: '',
      member_price: null,
      non_member_price: null,
      pos_member_price: null,
      pos_non_member_price: null,
      is_percentage: false,
      percentage_value: null,
    },
  });

  const isPercentage = form.watch('is_percentage');

  React.useEffect(() => {
    if (open) {
      form.reset(rate ? {
        item_name: rate.item_name,
        member_price: rate.member_price,
        non_member_price: rate.non_member_price,
        pos_member_price: rate.pos_member_price,
        pos_non_member_price: rate.pos_non_member_price,
        is_percentage: rate.is_percentage ?? false,
        percentage_value: rate.percentage_value,
      } : {
        item_name: '',
        member_price: null,
        non_member_price: null,
        pos_member_price: null,
        pos_non_member_price: null,
        is_percentage: false,
        percentage_value: null,
      });
    }
  }, [open, rate, form]);

  const handleSubmit = (data: RateFormData) => {
    const cleanedData: Omit<Rate, 'id' | 'created_at'> = {
        ...data,
        member_price: data.is_percentage ? null : data.member_price,
        non_member_price: data.is_percentage ? null : data.non_member_price,
        pos_member_price: data.is_percentage ? null : data.pos_member_price,
        pos_non_member_price: data.is_percentage ? null : data.pos_non_member_price,
        percentage_value: data.is_percentage ? data.percentage_value : null,
    };
    onSubmit(cleanedData, rate?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rate ? 'Editar Tarifa' : 'Agregar Tarifa'}</DialogTitle>
          <DialogDescription>
            {rate ? 'Modifica los detalles de la tarifa.' : 'Ingresa los detalles de la nueva tarifa.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="item_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Ítem</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Hora de vuelo LV-GSA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="is_percentage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>¿Es un porcentaje?</FormLabel>
                    <FormDescription>
                      Marque si esta tarifa es un % de otro valor.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <Separator />

            {isPercentage ? (
              <FormField
                control={form.control}
                name="percentage_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor del Porcentaje (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="25" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="member_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Socio (Efectivo/Transf.)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="75000" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="non_member_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio No Socio (Efectivo/Transf.)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="90000" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pos_member_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Socio (POS)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="82500" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pos_non_member_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio No Socio (POS)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="99000" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">{rate ? 'Guardar Cambios' : 'Crear Tarifa'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
