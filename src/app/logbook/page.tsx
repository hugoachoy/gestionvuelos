
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plane, Feather, List, FileText } from 'lucide-react'; // Changed Sailboat to Feather, Added FileText

export default function LogbookPage() {
  return (
    <>
      <PageHeader title="Libro de Vuelo" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Feather className="mr-2 h-6 w-6 text-primary" /> {/* Changed Sailboat to Feather */}
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
              <FileText className="mr-2 h-6 w-6 text-primary" /> {/* Changed List to FileText */}
              Informes y Resúmenes
            </CardTitle>
            <CardDescription>Genera informes y visualiza estadísticas de vuelos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/logbook/reports">Acceder a Informes</Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Genera informes detallados de vuelos por rango de fechas.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 p-4 border rounded-lg bg-card text-card-foreground">
        <h3 className="text-lg font-semibold mb-2">Próximos Pasos (Fase 2 - Libro de Vuelo):</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><span className="font-semibold text-green-600">[Hecho]</span> Creación de tablas en Base de Datos.</li>
          <li><span className="font-semibold text-green-600">[Hecho]</span> Navegación desde Agenda a formularios.</li>
          <li><span className="font-semibold text-green-600">[Hecho]</span> Implementar formularios para registrar vuelos de planeador y motor.</li>
          <li><span className="font-semibold text-green-600">[Hecho]</span> Desarrollar listados para visualizar los vuelos registrados.</li>
          <li>Implementar políticas RLS detalladas si es necesario.</li>
          <li><span className="font-semibold text-blue-600">[En Progreso]</span> Desarrollar sección de informes.</li>
        </ul>
      </div>
    </>
  );
}
