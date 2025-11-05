
import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';
import { NotamClient } from './components/notam-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function NotamsPage() {
  return (
    <>
      <PageHeader title="Información de Aeródromo (LIO)" />
      <Suspense fallback={<NotamSkeleton />}>
        <NotamClient />
      </Suspense>
    </>
  );
}


function NotamSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-32 w-full" />
            <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
}
