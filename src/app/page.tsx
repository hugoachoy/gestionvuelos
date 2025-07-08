import { Suspense } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { MaintenanceWarnings } from '@/components/dashboard/maintenance-warnings';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarDays, BookOpen, Plane } from 'lucide-react';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Tablero Principal" />
      <Suspense fallback={<MaintenanceWarningsSkeleton />}>
        <MaintenanceWarnings />
      </Suspense>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
