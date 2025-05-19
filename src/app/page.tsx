import { ScheduleClient } from './schedule-client';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <Suspense fallback={<div>Cargando agenda...</div>}>
      <ScheduleClient />
    </Suspense>
  );
}
