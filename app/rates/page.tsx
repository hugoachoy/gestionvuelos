
import { RatesViewerClient } from './components/rates-viewer-client';
import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function RatesViewerPage() {
  return (
    <>
        <PageHeader title="Tarifas Vigentes" />
        <Suspense fallback={<RatesSkeleton />}>
            <RatesViewerClient />
        </Suspense>
    </>
  );
}

function RatesSkeleton() {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
            <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
}
