
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Comprobar si hay un mensaje de éxito desde el registro
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === 'success') {
      toast({
        title: "Registro Exitoso",
        description: "Ahora puedes iniciar sesión con tus credenciales.",
        variant: "default",
      });
      // Limpiar el parámetro de la URL
      router.replace('/login', undefined);
    }
    if (params.get('reset_success') === 'true') {
      toast({
        title: "Correo Enviado",
        description: "Si el correo existe, recibirás instrucciones para restablecer tu contraseña.",
        variant: "default",
        duration: 7000,
      });
      router.replace('/login', undefined);
    }
  }, [router, toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: loginError } = await login({ email, password });
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
    } else {
      router.push('/'); // Redirigir a la página principal después del login
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Iniciar Sesión</CardTitle>
          <CardDescription className="text-center">
            Ingresa tus credenciales para acceder a Turnos de Vuelo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-sm space-y-2">
          <Link href="/forgot-password" passHref legacyBehavior>
            <a className="text-xs text-muted-foreground hover:text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </Link>
          <p>
            ¿No tienes cuenta?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Regístrate
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
