
import { Suspense } from 'react';
import { EngineFlightListClient } from './components/engine-flight-list-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function EngineFlightListPage() {
  return (
    <>
      <PageHeader title="Historial de Vuelos a Motor" />
      <Suspense fallback={<ListSkeleton />}>
        <EngineFlightListClient />
      </Suspense>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-10" /> 
      </div>
      <Skeleton className="h-12 w-full" /> {/* Header */}
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
