
import { Suspense } from 'react';
import { AdminClient } from './components/admin-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

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
      <Suspense fallback={<AdminSkeleton />}>
        <AdminClient />
      </Suspense>
    </>
  );
}

function AdminSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
