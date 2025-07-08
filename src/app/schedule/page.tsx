import { ScheduleClient } from '@/app/schedule-client';
import { Suspense } from 'react';
import { PageHeader } from '@/components/common/page-header';

export default function SchedulePage() {
  return (
    <>
      <PageHeader title="Agenda de Vuelos" />
      <Suspense fallback={<div>Cargando agenda...</div>}>
        <ScheduleClient />
      </Suspense>
    </>
  );
}
