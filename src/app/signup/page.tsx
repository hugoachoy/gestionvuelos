
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotsStore } from '@/store/data-hooks';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { Pilot } from '@/types';
import { useToast } from "@/hooks/use-toast";


// Esquema de validación con Zod
const signupSchema = z.object({
  first_name: z.string().min(1, "El nombre es obligatorio."),
  last_name: z.string().min(1, "El apellido es obligatorio."),
  email: z.string().email("Correo electrónico inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  confirmPassword: z.string().min(6, "La confirmación de contraseña debe tener al menos 6 caracteres."),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"], // path of error
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signUp } = useAuth();
  const { addPilot } = usePilotsStore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (formData: SignupFormData) => {
    setLoading(true);
    setServerError(null);

    const { data: authData, error: authError } = await signUp({
      email: formData.email,
      password: formData.password,
    });

    if (authError || !authData.user) {
      setServerError(authError?.message || "Error al crear el usuario en Supabase Auth.");
      setLoading(false);
      return;
    }

    // Usuario creado en Supabase Auth, ahora crear perfil de piloto
    const newPilotData: Omit<Pilot, 'id' | 'created_at'> = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      auth_user_id: authData.user.id,
      category_ids: [], // Los pilotos se registran sin categorías inicialmente
      medical_expiry: '2099-01-01', // Placeholder, el usuario/admin deberá actualizar esto
      is_admin: false, // Por defecto los nuevos usuarios no son admin
    };

    const pilotProfile = await addPilot(newPilotData);

    if (!pilotProfile) {
      setServerError("Usuario de autenticación creado, pero falló la creación del perfil de piloto. Contacta al administrador.");
      setLoading(false);
      return;
    }
    
    setLoading(false);
    toast({
        title: "Registro Exitoso",
        description: "Tu cuenta ha sido creada. Por favor, revisa tu correo electrónico para validar tu cuenta antes de iniciar sesión.",
        variant: "default",
        duration: 7000, 
    });
    router.push('/login?signup=success'); 
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background py-12">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Crear Cuenta de Piloto</CardTitle>
          <CardDescription className="text-center">
            Completa tus datos para registrarte en Turnos de Vuelo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <Input placeholder="Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="juan.perez@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {serverError && <p className="text-sm text-destructive text-center">{serverError}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Registrando...' : 'Crear Cuenta'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <p>
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Inicia Sesión
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

