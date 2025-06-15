
import { Suspense } from 'react';
import { GliderFlightFormClient } from '@/app/logbook/glider/new/components/glider-flight-form-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient';
import type { CompletedGliderFlight } from '@/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function getFlightData(flightId: string): Promise<CompletedGliderFlight | null> {
  try {
    const { data, error: supabaseError } = await supabase
      .from('completed_glider_flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (supabaseError) {
      // Log only if there's a descriptive message.
      // Avoid logging if supabaseError is just {} or has no meaningful message.
      if (typeof supabaseError.message === 'string' && supabaseError.message.trim() !== '') {
        console.error(`Supabase error fetching glider flight ${flightId}:`, supabaseError);
      }
      // Regardless of logging, if there's any supabaseError object, treat it as an error and return null.
      return null;
    }
    // If no error and data is null (not found by .single()), it will correctly return null.
    return data as CompletedGliderFlight;

  } catch (e: any) {
    // Catch any other unexpected errors during the operation
    console.error(`Unexpected exception fetching glider flight ${flightId}:`, e);
    return null;
  }
}

export default async function EditGliderFlightPage({ params }: { params: { flightId: string } }) {
  const flightData = await getFlightData(params.flightId);

  if (!flightData) {
    return (
      <>
        <PageHeader title="Editar Vuelo en Planeador" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudo encontrar el vuelo solicitado o no tienes permiso para editarlo.
            <Link href="/logbook/glider/list" className="block mt-2">
              <Button variant="outline">Volver al listado</Button>
            </Link>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Editar Vuelo en Planeador" />
      <Suspense fallback={<FormSkeleton />}>
        <GliderFlightFormClient flightToEdit={flightData} />
      </Suspense>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
