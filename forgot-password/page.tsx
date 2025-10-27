
"use client";

import React, { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation'; // Import useRouter

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter(); // Initialize useRouter

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`, // URL a la que se redirigirá después de hacer clic en el enlace del correo
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      toast({
        title: "Error",
        description: resetError.message,
        variant: "destructive",
      });
    } else {
      // No mostramos un mensaje de éxito aquí para evitar la enumeración de correos.
      // Redirigimos a la página de login con un parámetro.
      router.push('/login?reset_success=true');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Restablecer Contraseña</CardTitle>
          <CardDescription className="text-center">
            Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña.
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
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Instrucciones'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Volver a Iniciar Sesión
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
