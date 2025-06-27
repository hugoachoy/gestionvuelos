
import { Suspense } from 'react';
import { FlightStatsClient } from './components/flight-stats-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function FlightStatsPage() {
  return (
    <>
      <PageHeader title="Estadísticas de Vuelo" />
      <Suspense fallback={<StatsSkeleton />}>
        <FlightStatsClient />
      </Suspense>
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
