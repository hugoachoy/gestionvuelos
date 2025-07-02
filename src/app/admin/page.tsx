
import { Suspense } from 'react';
import { AdminClient } from './components/admin-client';
import { BillingReportClient } from './components/billing-report-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, Receipt } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Panel de Administración" />
       <Alert variant="default" className="mb-6 border-blue-500 bg-blue-50 text-blue-800">
        <Shield className="h-4 w-4 !text-blue-600" />
        <AlertTitle>Zona Segura</AlertTitle>
        <AlertDescription>
          Esta sección contiene acciones que pueden afectar a múltiples usuarios. Úsela con precaución.
        </AlertDescription>
      </Alert>
      <div className="space-y-8">
        <Suspense fallback={<EmailSummarySkeleton />}>
          <AdminClient />
        </Suspense>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Receipt className="mr-2 h-6 w-6 text-primary" />
                    Informe de Facturación
                </CardTitle>
                <CardDescription>
                    Genere informes de vuelos a facturar por piloto y rango de fechas.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Suspense fallback={<BillingReportSkeleton />}>
                    <BillingReportClient />
                </Suspense>
            </CardContent>
        </Card>
      </div>
    </>
  );
}

function EmailSummarySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-56" />
      </CardContent>
    </Card>
  );
}

function BillingReportSkeleton() {
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
