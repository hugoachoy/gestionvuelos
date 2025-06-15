
import { Suspense } from 'react';
import { GliderFlightFormClient } from '@/app/logbook/glider/new/components/glider-flight-form-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
// Supabase y getFlightData ya no son necesarios aquí porque la carga se hace en el cliente.

export default async function EditGliderFlightPage({ params }: { params: { flightId: string } }) {
  // Ya no se cargan datos aquí. El flightId se pasa al componente cliente.
  return (
    <>
      <PageHeader title="Editar Vuelo en Planeador" />
      <Suspense fallback={<FormSkeleton />}>
        {/* Pasamos el flightId para que el cliente lo cargue */}
        <GliderFlightFormClient flightIdToLoad={params.flightId} />
      </Suspense>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
