
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plane, Feather, BarChart3, Library, History } from 'lucide-react';

export default function LogbookPage() {
  return (
    <>
      <PageHeader title="Libro de Vuelo" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* --- Primary Actions --- */}
        <Card className="border-primary/50 shadow-lg">
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

        <Card className="border-primary/50 shadow-lg">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-6 w-6 text-primary" />
              Otros Informes y Resúmenes
            </CardTitle>
            <CardDescription>
              Genera estadísticas y otros informes de tus vuelos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/logbook/reports">Ir a Informes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
