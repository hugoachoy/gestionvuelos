
import { Suspense } from 'react';
import { GliderFlightListClient } from './components/glider-flight-list-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function GliderFlightListPage() {
  return (
    <>
      <PageHeader title="Historial de Vuelos en Planeador" />
      <Suspense fallback={<ListSkeleton />}>
        <GliderFlightListClient />
      </Suspense>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Skeleton className="h-12 w-full" /> 
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
