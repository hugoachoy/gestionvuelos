import { PilotClient } from './components/pilot-client';
import { Suspense } from 'react';

export default function PilotsPage() {
  return (
    <Suspense fallback={<div>Cargando pilotos...</div>}>
      <PilotClient />
    </Suspense>
  );
}
