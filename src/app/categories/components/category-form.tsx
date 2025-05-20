
"use client";

import type { PilotCategory } from '@/types';
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

// Schema uses snake_case matching the Type and DB
const categorySchema = z.object({
  name: z.string().min(1, "El nombre de la categoría es obligatorio."),
});

// This FormData type will have snake_case fields
type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CategoryFormData, categoryId?: string) => void;
  category?: PilotCategory; // PilotCategory type has snake_case fields
}

export function CategoryForm({ open, onOpenChange, onSubmit, category }: CategoryFormProps) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: category ? { name: category.name } : { name: '' },
  });

  // data from form.handleSubmit will be CategoryFormData (snake_case)
  const handleSubmit = (data: CategoryFormData) => {
    onSubmit(data, category?.id);
    form.reset(); // Reset with default structure
    onOpenChange(false);
  };

  // When dialog opens or category changes, reset form with new defaultValues
  React.useEffect(() => {
    if (open) {
      form.reset(category ? { name: category.name } : { name: '' });
    }
  }, [open, category, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoría' : 'Agregar Categoría'}</DialogTitle>
          <DialogDescription>
            {category ? 'Modifica el nombre de la categoría.' : 'Ingresa el nombre de la nueva categoría.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name" // Corresponds to 'name' in categorySchema
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Categoría</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Piloto Instructor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {form.reset(); onOpenChange(false);}}>Cancelar</Button>
              <Button type="submit">{category ? 'Guardar Cambios' : 'Crear Categoría'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
