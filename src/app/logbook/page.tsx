
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plane, Feather, Library, History, BarChart3 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FlightStats } from './components/flight-stats';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function LogbookPage() {
  return (
    <>
      <PageHeader title="Libro de Vuelo" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* --- Primary Actions --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Feather className="mr-2 h-6 w-6 text-primary" />
              Vuelos en Planeador
            </CardTitle>
            <CardDescription>Registra un nuevo vuelo realizado en planeador.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/logbook/glider/new">Registrar Nuevo Vuelo en Planeador</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plane className="mr-2 h-6 w-6 text-primary" />
              Vuelos a Motor
            </CardTitle>
            <CardDescription>Registra un nuevo vuelo realizado en avión a motor.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/logbook/engine/new">Registrar Nuevo Vuelo a Motor</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Library className="mr-2 h-6 w-6 text-primary" />
              Historial Unificado de Vuelos
            </CardTitle>
            <CardDescription>
              Consulta un historial combinado de todos tus vuelos, tanto de motor como de planeador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/logbook/reports/unified-history">Ver Historial Unificado</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="mr-2 h-6 w-6 text-primary" />
              Historial de Vuelos en Planeador
            </CardTitle>
            <CardDescription>
              Consulta y exporta tu historial de vuelos en planeador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/logbook/glider/list">Ver Historial de Planeador</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="mr-2 h-6 w-6 text-primary" />
              Historial de Vuelos a Motor
            </CardTitle>
            <CardDescription>
              Consulta y exporta tu historial de vuelos a motor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/logbook/engine/list">Ver Historial de Motor</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />
      
      <div className="space-y-4">
        <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Estadísticas Rápidas</h2>
        </div>
        <p className="text-muted-foreground">
            Filtra por piloto y rango de fechas para obtener un resumen rápido de las horas de vuelo.
        </p>
        <Suspense fallback={<StatsSkeleton />}>
          <FlightStats />
        </Suspense>
      </div>
    </>
  );
}


function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Skeleton className="h-10 w-full sm:w-64" />
        <Skeleton className="h-10 w-full sm:w-64" />
        <Skeleton className="h-10 w-full sm:w-48" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
