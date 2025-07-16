
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import React from 'react';

const rateSchema = z.object({
  item_name: z.string().min(3, "El nombre del ítem es obligatorio y debe tener al menos 3 caracteres."),
  member_price: z.coerce.number().min(0, "El precio debe ser un número positivo.").optional().nullable(),
  non_member_price: z.coerce.number().min(0, "El precio debe ser un número positivo.").optional().nullable(),
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
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(rate ? {
        item_name: rate.item_name,
        member_price: rate.member_price,
        non_member_price: rate.non_member_price,
      } : {
        item_name: '',
        member_price: null,
        non_member_price: null,
      });
    }
  }, [open, rate, form]);

  const handleSubmit = (data: RateFormData) => {
    onSubmit(data, rate?.id);
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
              name="member_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio Socio</FormLabel>
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
                  <FormLabel>Precio No Socio</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="90000" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
