
import { Suspense } from 'react';
import { UnifiedHistoryClient } from './components/unified-history-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function UnifiedHistoryPage() {
  return (
    <>
      <PageHeader title="Historial Unificado de Vuelos" />
      <Suspense fallback={<ReportSkeleton />}>
        <UnifiedHistoryClient />
      </Suspense>
    </>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Skeleton className="h-10 w-full sm:w-64" />
        <Skeleton className="h-10 w-full sm:w-64" />
        <Skeleton className="h-10 w-full sm:w-48" />
      </div>
      <Skeleton className="h-12 w-full" /> {/* Table Header */}
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
