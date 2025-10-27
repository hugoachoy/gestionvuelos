
"use client";

import { Suspense } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { MaintenanceWarnings } from '@/components/dashboard/maintenance-warnings';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarDays, BookOpen, Plane, Sheet, AlertTriangle, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function LoginPrompt() {
  return (
    <Alert className="mb-6 border-primary bg-primary/10 text-primary-foreground">
      <AlertTriangle className="h-4 w-4 text-primary" />
      <AlertTitle className="font-bold text-primary">¡Bienvenido!</AlertTitle>
      <AlertDescription className="text-primary/90">
        Para acceder a la agenda, registrar vuelos y ver toda la funcionalidad, por favor, inicia sesión.
      </AlertDescription>
      <div className="mt-4">
        <Button asChild variant="default" className="bg-primary/90 hover:bg-primary/100 text-primary-foreground">
          <Link href="/login">
            <LogIn className="mr-2 h-4 w-4" />
            Iniciar Sesión
          </Link>
        </Button>
      </div>
    </Alert>
  );
}


export default function DashboardPage() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
        <>
            <PageHeader title="Tablero Principal" />
            <Skeleton className="h-24 w-full mb-6" />
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </>
    );
  }

  return (
    <>
      <PageHeader title="Tablero Principal" />

      {!user && <LoginPrompt />}

      {user && (
        <Suspense fallback={<MaintenanceWarningsSkeleton />}>
          <MaintenanceWarnings />
        </Suspense>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {user && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDays className="mr-2 h-6 w-6 text-primary" />
                  Agenda de Vuelos
                </CardTitle>
                <CardDescription>
                  Ver y gestionar los turnos de vuelo programados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/schedule">Ir a la Agenda</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="mr-2 h-6 w-6 text-primary" />
                  Libro de Vuelo
                </CardTitle>
                <CardDescription>
                  Registrar y consultar vuelos realizados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/logbook">Ir al Libro de Vuelo</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plane className="mr-2 h-6 w-6 text-primary" />
                  Gestión de Flota
                </CardTitle>
                <CardDescription>
                  Ver el estado y los detalles de las aeronaves.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/aircraft">Ir a Aeronaves</Link>
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sheet className="mr-2 h-6 w-6 text-primary" />
                  Tarifas Vigentes
                </CardTitle>
                <CardDescription>
                  Consulta el listado de precios actual y exporta a PDF.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/rates">Consultar Tarifas</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function MaintenanceWarningsSkeleton() {
    return (
        <Card className="mb-6">
            <CardHeader>
                 <Skeleton className="h-6 w-48" />
                 <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    );
}
