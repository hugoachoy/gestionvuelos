
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plane, Feather, FileText } from 'lucide-react';

export default function LogbookPage() {
  return (
    <>
      <PageHeader title="Libro de Vuelo" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Feather className="mr-2 h-6 w-6 text-primary" />
              Vuelos en Planeador
            </CardTitle>
            <CardDescription>Registra y consulta vuelos realizados en planeadores.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
            <Button asChild>
              <Link href="/logbook/glider/new">Registrar Nuevo Vuelo en Planeador</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/logbook/glider/list">Ver Historial de Vuelos en Planeador</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plane className="mr-2 h-6 w-6 text-primary" />
              Vuelos a Motor
            </CardTitle>
            <CardDescription>Registra y consulta vuelos realizados en aviones a motor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
            <Button asChild>
              <Link href="/logbook/engine/new">Registrar Nuevo Vuelo a Motor</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/logbook/engine/list">Ver Historial de Vuelos a Motor</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-6 w-6 text-primary" />
              Informes y Resúmenes
            </CardTitle>
            <CardDescription>Genera informes y visualiza estadísticas de vuelos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href="/logbook/reports">Acceder a Informes</Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Genera informes detallados de vuelos por rango de fechas.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
