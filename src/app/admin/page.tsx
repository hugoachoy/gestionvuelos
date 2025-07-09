"use client";

import { Suspense } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { BillingReportClient } from './components/billing-report-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Administración - Facturación por Piloto" />
      <Suspense fallback={<ReportSkeleton />}>
        <BillingReportClient />
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
