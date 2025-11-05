
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
  FormDescription,
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
import { CalendarIcon, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { Separator } from '@/components/ui/separator';
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, startOfDay, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DeleteDialog } from '@/components/common/delete-dialog';

const createPilotSchema = (originalMedicalExpiryDateString?: string | null) => {
  const originalExpiryDate = originalMedicalExpiryDateString && isValid(parseISO(originalMedicalExpiryDateString)) 
    ? startOfDay(parseISO(originalMedicalExpiryDateString)) 
    : null;

  return z.object({
    first_name: z.string().min(1, "El nombre es obligatorio."),
    last_name: z.string().min(1, "El apellido es obligatorio."),
    category_ids: z.array(z.string()).min(1, "Seleccione al menos una categoría."),
    medical_expiry: z.date({
        required_error: "La fecha de vencimiento del psicofísico es obligatoria.",
        invalid_type_error: "Fecha inválida."
      })
      .refine(submittedDateObj => {
        const today = startOfDay(new Date());
        const submittedDate = startOfDay(submittedDateObj);

        if (originalExpiryDate) { // Editing existing pilot
          if (isBefore(originalExpiryDate, today)) { // Original was already expired
            return submittedDate.getTime() === originalExpiryDate.getTime() || submittedDate >= today;
          } else { // Original was not expired
            return submittedDate >= today;
          }
        } else { // Creating new pilot
          return submittedDate >= today;
        }
      }, {
        message: "El vencimiento no puede ser anterior a hoy. Si edita un psicofísico vencido, puede mantener la fecha original o actualizarla a una futura."
      }),
    is_admin: z.boolean().optional(),
    
    // Personal Info
    dni: z.string().nullable().optional(),
    birth_date: z.date().nullable().optional(),
    address: z.string().nullable().optional(),
    email: z.string().email({ message: "Correo electrónico inválido." }).nullable().optional(),
    phone: z.string().nullable().optional(),
  });
};

type PilotFormData = z.infer<ReturnType<typeof createPilotSchema>>;


interface PilotFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Pilot, 'id' | 'created_at'>, pilotId?: string) => void;
  pilot?: Pilot;
  categories: PilotCategory[];
  allowIsAdminChange?: boolean;
}

export function PilotForm({ open, onOpenChange, onSubmit, pilot, categories, allowIsAdminChange = false }: PilotFormProps) {
  const { user: currentUser } = useAuth();
  
  const pilotSchema = useMemo(() => createPilotSchema(pilot?.medical_expiry), [pilot?.medical_expiry]);

  const form = useForm<PilotFormData>({
    resolver: zodResolver(pilotSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      category_ids: [],
      medical_expiry: new Date(),
      is_admin: false,
      dni: null,
      birth_date: null,
      address: null,
      email: null,
      phone: null,
    },
  });

  const [isMedicalCalendarOpen, setIsMedicalCalendarOpen] = useState(false);
  const [isBirthDateCalendarOpen, setIsBirthDateCalendarOpen] = useState(false);
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);


  useEffect(() => {
    if (open) {
      const initialFormValues = pilot
        ? {
            first_name: pilot.first_name || '',
            last_name: pilot.last_name || '',
            category_ids: pilot.category_ids || [],
            medical_expiry: pilot.medical_expiry && isValid(parseISO(pilot.medical_expiry)) ? parseISO(pilot.medical_expiry) : new Date(),
            is_admin: pilot.is_admin ?? false,
            dni: pilot.dni,
            birth_date: pilot.birth_date && isValid(parseISO(pilot.birth_date)) ? parseISO(pilot.birth_date) : null,
            address: pilot.address,
            email: pilot.email,
            phone: pilot.phone,
          }
        : {
            first_name: '',
            last_name: '',
            category_ids: [],
            medical_expiry: new Date(),
            is_admin: false,
            dni: null,
            birth_date: null,
            address: null,
            email: null,
            phone: null,
          };
      form.reset(initialFormValues);
    }
  }, [open, pilot, form, pilotSchema]);


  const handleSubmit = (data: PilotFormData) => {
    const dataToSubmit: Omit<Pilot, 'id' | 'created_at'> = {
      first_name: data.first_name,
      last_name: data.last_name,
      dni: data.dni || null,
      birth_date: data.birth_date ? format(data.birth_date, 'yyyy-MM-dd') : null,
      address: data.address || null,
      email: data.email || null,
      phone: data.phone || null,
      category_ids: data.category_ids,
      medical_expiry: format(data.medical_expiry, 'yyyy-MM-dd'),
      is_admin: data.is_admin ?? false,
      auth_user_id: pilot?.auth_user_id || null, 
    };

    onSubmit(dataToSubmit, pilot?.id);
    onOpenChange(false);
  };

  const handleUnlinkUser = () => {
    if (!pilot || !pilot.auth_user_id) return;

    // Create a payload that is essentially the current pilot but with auth_user_id set to null
    const unlinkedData: Omit<Pilot, 'id' | 'created_at'> = {
        first_name: pilot.first_name,
        last_name: pilot.last_name,
        dni: pilot.dni,
        birth_date: pilot.birth_date, // Already in string format from DB
        address: pilot.address,
        email: pilot.email,
        phone: pilot.phone,
        category_ids: pilot.category_ids,
        medical_expiry: pilot.medical_expiry, // Already in string format from DB
        is_admin: pilot.is_admin,
        auth_user_id: null, // The only change
    };
    
    onSubmit(unlinkedData, pilot.id);
    onOpenChange(false);
    setIsUnlinkConfirmOpen(false);
  };


  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pilot ? 'Editar Piloto' : 'Agregar Piloto'}</DialogTitle>
          <DialogDescription>
            {pilot ? 'Modifica los detalles del piloto.' : 'Ingresa los detalles del nuevo piloto.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
            
            <h3 className="text-lg font-semibold text-foreground border-b pb-2">Datos Aeronáuticos</h3>

            <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Juan" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="last_name" render={({ field }) => (
                <FormItem><FormLabel>Apellido</FormLabel><FormControl><Input placeholder="Perez" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="category_ids" render={({ field }) => {
                const selectedCount = field.value?.length || 0;
                const buttonText = selectedCount === 0 ? "Seleccionar categorías" : `${selectedCount} categoría${selectedCount > 1 ? 's' : ''} seleccionada${selectedCount > 1 ? 's' : ''}`;
                return (
                  <FormItem><FormLabel>Categorías</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between",!field.value?.length && "text-muted-foreground")}>
                            <span className="truncate">{buttonText}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                    </FormControl></PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><ScrollArea className="h-48">
                        {categories.map((category) => (
                          <FormItem key={category.id} className="flex flex-row items-center space-x-3 space-y-0 p-2 hover:bg-accent rounded-md">
                            <FormControl>
                              <Checkbox checked={field.value?.includes(category.id)} onCheckedChange={(checked) => {
                                  const currentCategoryIds = field.value || [];
                                  return checked ? field.onChange([...currentCategoryIds, category.id]) : field.onChange(currentCategoryIds.filter((value) => value !== category.id));
                              }} id={`category-${category.id}`} aria-labelledby={`category-label-${category.id}`}/>
                            </FormControl>
                            <FormLabel htmlFor={`category-${category.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1" id={`category-label-${category.id}`}>{category.name}</FormLabel>
                          </FormItem>
                        ))}
                    </ScrollArea></PopoverContent></Popover><FormMessage />
                  </FormItem>);
            }}/>
            <FormField control={form.control} name="medical_expiry" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Vencimiento Psicofísico</FormLabel>
                  <Popover open={isMedicalCalendarOpen} onOpenChange={setIsMedicalCalendarOpen}>
                    <PopoverTrigger asChild><FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </FormControl></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={(date) => { if(date) field.onChange(date); setIsMedicalCalendarOpen(false); }} initialFocus locale={es} />
                    </PopoverContent>
                  </Popover><FormMessage />
                </FormItem>
            )}/>
            {(allowIsAdminChange) && (
              <FormField control={form.control} name="is_admin" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5"><FormLabel htmlFor="is_admin_checkbox" id="is_admin_label">Administrador</FormLabel>
                      <FormDescription>Permitir acceso administrativo al piloto.</FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox id="is_admin_checkbox" checked={field.value ?? false} onCheckedChange={field.onChange} aria-labelledby="is_admin_label" disabled={!currentUser?.is_admin} />
                    </FormControl>
                  </FormItem>
              )}/>
            )}

            <Separator className="my-6" />
            <h3 className="text-lg font-semibold text-foreground border-b pb-2">Datos Personales y de Contacto</h3>
            
            <FormField control={form.control} name="dni" render={({ field }) => (
                <FormItem><FormLabel>DNI</FormLabel><FormControl><Input placeholder="30123456" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="birth_date" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Fecha de Nacimiento</FormLabel>
                  <Popover open={isBirthDateCalendarOpen} onOpenChange={setIsBirthDateCalendarOpen}>
                    <PopoverTrigger asChild><FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </FormControl></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={(date) => { if(date) field.onChange(date); setIsBirthDateCalendarOpen(false); }} captionLayout="dropdown-buttons" fromYear={1940} toYear={new Date().getFullYear()} initialFocus locale={es} />
                    </PopoverContent>
                  </Popover><FormMessage />
                </FormItem>
            )}/>
             <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Dirección</FormLabel><FormControl><Input placeholder="Av. Siempre Viva 742" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="piloto@email.com" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input placeholder="2345678901" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )}/>
            
             {pilot?.auth_user_id && allowIsAdminChange && (
              <>
                <Separator className="my-6" />
                <div className="space-y-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <h3 className="text-lg font-semibold text-destructive">Zona de Peligro</h3>
                    <div className="space-y-2">
                        <FormLabel>Usuario Vinculado</FormLabel>
                        <p className="text-sm text-destructive/90">
                            Este perfil de piloto está vinculado a la cuenta de autenticación: <strong className="font-mono">{pilot.email}</strong>.
                        </p>
                        <p className="text-xs text-destructive/80">
                           Al desvincular, el usuario con este correo ya no podrá acceder a los datos de este piloto. El perfil del piloto y todo su historial de vuelos se conservarán, pero no tendrán un inicio de sesión asociado hasta que un administrador lo vincule a otra cuenta.
                        </p>
                    </div>
                    <Button type="button" variant="destructive" onClick={() => setIsUnlinkConfirmOpen(true)}>
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Desvincular Usuario de Autenticación
                    </Button>
                </div>
              </>
            )}


            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => { onOpenChange(false); }}>Cancelar</Button>
              <Button type="submit">{pilot ? 'Guardar Cambios' : 'Crear Piloto'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <DeleteDialog
        open={isUnlinkConfirmOpen}
        onOpenChange={setIsUnlinkConfirmOpen}
        onConfirm={handleUnlinkUser}
        itemName={`la cuenta de login de ${pilot?.email} del perfil de este piloto`}
    />
    </>
  );
}
