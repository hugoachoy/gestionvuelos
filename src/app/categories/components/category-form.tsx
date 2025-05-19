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

const categorySchema = z.object({
  name: z.string().min(1, "El nombre de la categoría es obligatorio."),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CategoryFormData, categoryId?: string) => void;
  category?: PilotCategory;
}

export function CategoryForm({ open, onOpenChange, onSubmit, category }: CategoryFormProps) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: category ? { name: category.name } : { name: '' },
  });

  const handleSubmit = (data: CategoryFormData) => {
    onSubmit(data, category?.id);
    form.reset();
    onOpenChange(false);
  };

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
              name="name"
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
