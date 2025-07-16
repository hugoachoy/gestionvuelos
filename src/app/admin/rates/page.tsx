import { RatesClient } from './components/rates-client';
import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';

export default function RatesPage() {
  return (
    <>
        <PageHeader title="Gestión de Tarifas" />
        <Suspense fallback={<div>Cargando tarifas...</div>}>
            <RatesClient />
        </Suspense>
    </>
  );
}
