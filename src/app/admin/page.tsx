
import { Suspense } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Panel de Administración" />
       <Alert variant="default" className="mb-6 border-blue-500 bg-blue-50 text-blue-800">
        <Shield className="h-4 w-4 !text-blue-600" />
        <AlertTitle>Zona Segura</AlertTitle>
        <AlertDescription>
          Esta sección contiene herramientas administrativas. Úsela con precaución. El informe de facturación se ha movido a la sección de <Link href="/logbook/reports/billing" className="font-semibold underline hover:text-blue-700">Informes del Libro de Vuelo</Link>.
        </AlertDescription>
      </Alert>
    </>
  );
}
