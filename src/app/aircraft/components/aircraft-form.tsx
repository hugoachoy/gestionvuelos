
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
import React from 'react'; // Added import

// Schema uses snake_case matching the Type and DB
const aircraftSchema = z.object({
  name: z.string().min(1, "El nombre/matrícula es obligatorio."),
  type: z.enum(['Tow Plane', 'Glider'], { required_error: "El tipo de aeronave es obligatorio." }),
});

// This FormData type will have snake_case fields
type AircraftFormData = z.infer<typeof aircraftSchema>;

interface AircraftFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AircraftFormData, aircraftId?: string) => void;
  aircraft?: Aircraft; // Aircraft type has snake_case fields
}

export function AircraftForm({ open, onOpenChange, onSubmit, aircraft }: AircraftFormProps) {
  const form = useForm<AircraftFormData>({
    resolver: zodResolver(aircraftSchema),
    // defaultValues match the Zod schema (snake_case)
    defaultValues: aircraft ? { name: aircraft.name, type: aircraft.type } : { name: '', type: undefined },
  });

  // data from form.handleSubmit will be AircraftFormData (snake_case)
  const handleSubmit = (data: AircraftFormData) => {
    onSubmit(data, aircraft?.id);
    form.reset(); // Reset with default structure
    onOpenChange(false);
  };
  
  // When dialog opens or aircraft changes, reset form with new defaultValues
  React.useEffect(() => {
    if (open) {
      form.reset(aircraft ? { name: aircraft.name, type: aircraft.type } : { name: '', type: undefined });
    }
  }, [open, aircraft, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{aircraft ? 'Editar Aeronave' : 'Agregar Aeronave'}</DialogTitle>
          <DialogDescription>
            {aircraft ? 'Modifica los detalles de la aeronave.' : 'Ingresa los detalles de la nueva aeronave.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name" // Corresponds to 'name' in aircraftSchema
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre/Matrícula</FormLabel>
                  <FormControl>
                    <Input placeholder="LV-ABC" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type" // Corresponds to 'type' in aircraftSchema
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Aeronave</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Tow Plane">Avión Remolcador</SelectItem>
                      <SelectItem value="Glider">Planeador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {form.reset(); onOpenChange(false);}}>Cancelar</Button>
              <Button type="submit">{aircraft ? 'Guardar Cambios' : 'Crear Aeronave'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
