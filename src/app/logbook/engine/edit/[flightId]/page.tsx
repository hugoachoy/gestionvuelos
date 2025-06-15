
import { Suspense } from 'react';
import { EngineFlightFormClient } from '@/app/logbook/engine/new/components/engine-flight-form-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
// Supabase y getFlightData ya no son necesarios aquí.

export default async function EditEngineFlightPage({ params }: { params: { flightId: string } }) {
  return (
    <>
      <PageHeader title="Editar Vuelo a Motor" />
      <Suspense fallback={<FormSkeleton />}>
        {/* Pasamos el flightId para que el cliente lo cargue */}
        <EngineFlightFormClient flightIdToLoad={params.flightId} />
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
