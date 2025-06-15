
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
      // Log only if there's a descriptive message.
      // Avoid logging if supabaseError is just {} or has no meaningful message.
      if (typeof supabaseError.message === 'string' && supabaseError.message.trim() !== '') {
        console.error(`Supabase error fetching engine flight ${flightId}:`, supabaseError);
      }
      // Regardless of logging, if there's any supabaseError object, treat it as an error and return null.
      return null;
    }
    // If no error and data is null (not found by .single()), it will correctly return null.
    return data as CompletedEngineFlight;

  } catch (e: any) {
    // Catch any other unexpected errors during the operation
    console.error(`Unexpected exception fetching engine flight ${flightId}:`, e);
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
