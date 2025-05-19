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
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const pilotSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio."),
  lastName: z.string().min(1, "El apellido es obligatorio."),
  categoryIds: z.array(z.string()).min(1, "Seleccione al menos una categoría."),
  medicalExpiry: z.date({ required_error: "La fecha de vencimiento del psicofísico es obligatoria." }),
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

  const handleSubmit = (data: PilotFormData) => {
    onSubmit(data, pilot?.id);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  <FormLabel>Vencimiento Psicofísico</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0,0,0,0)) // disable past dates
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
              <Button type="button" variant="outline" onClick={() => { form.reset(); onOpenChange(false);}}>Cancelar</Button>
              <Button type="submit">{pilot ? 'Guardar Cambios' : 'Crear Piloto'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
