
import { Suspense } from 'react';
import { EngineFlightFormClient } from '@/app/logbook/engine/new/components/engine-flight-form-client';
import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient';
import type { CompletedEngineFlight } from '@/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function getFlightData(flightId: string): Promise<CompletedEngineFlight | null> {
  try {
    const { data, error: supabaseError } = await supabase
      .from('completed_engine_flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (supabaseError) {
      // Log if there's a descriptive message, ensuring the message itself is part of the primary log string.
      const message = supabaseError.message;
      if (typeof message === 'string' && message.trim() !== '') {
        console.error(`Supabase error fetching engine flight ${flightId}: ${message}. Full error object:`, supabaseError);
      } else {
        // Log a generic message if specific message is not available but an error object exists
        console.error(`Supabase error (no specific message) fetching engine flight ${flightId}. Error object:`, supabaseError);
      }
      return null; // Critical: ensure we return null if Supabase indicates an error.
    }
    // If no error and data is null (not found by .single()), it will correctly return null.
    return data as CompletedEngineFlight;

  } catch (e: any) {
    // Catch any other unexpected errors during the operation
    // Ensure e.message is part of the primary log string.
    const errorMessage = e.message || "No specific message in caught exception.";
    console.error(`Unexpected exception while trying to fetch engine flight ${flightId}: ${errorMessage}. Full exception:`, e);
    return null;
  }
}

export default async function EditEngineFlightPage({ params }: { params: { flightId: string } }) {
  const flightData = await getFlightData(params.flightId);

  if (!flightData) {
     return (
      <>
        <PageHeader title="Editar Vuelo a Motor" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudo encontrar el vuelo solicitado o no tienes permiso para editarlo.
             <Link href="/logbook/engine/list" className="block mt-2">
              <Button variant="outline">Volver al listado</Button>
            </Link>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Editar Vuelo a Motor" />
      <Suspense fallback={<FormSkeleton />}>
        <EngineFlightFormClient flightToEdit={flightData} />
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
