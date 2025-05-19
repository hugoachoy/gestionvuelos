import { AircraftClient } from './components/aircraft-client';
import { Suspense } from 'react';

export default function AircraftPage() {
  return (
    <Suspense fallback={<div>Cargando aeronaves...</div>}>
      <AircraftClient />
    </Suspense>
  );
}
