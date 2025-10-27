
import { Suspense } from 'react';
import { TwilightClient } from './components/twilight-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function TwilightPage() {
  return (
    <>
      <PageHeader title="Cálculo de Crepúsculo Civil" />
      <Suspense fallback={<TwilightPageSkeleton />}>
        <TwilightClient />
      </Suspense>
    </>
  );
}

function TwilightPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full max-w-sm" /> {/* Calendar trigger */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
