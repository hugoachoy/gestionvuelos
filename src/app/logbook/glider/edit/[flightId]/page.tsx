
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

    // Condition 1: Supabase itself reported an error (e.g., RLS, network issue detailed by Supabase)
    if (supabaseError) {
      // Intentionally not logging console.error for handled cases like PGRST116.
      // The function will return null, and the UI handles the "not found" message.
      // For deep debugging, one might temporarily uncomment specific logging:
      // if (supabaseError.code === 'PGRST116') {
      //   console.info(`getFlightData (Glider): Flight ${flightId} not found or RLS issue (PGRST116). Supabase message: "${supabaseError.message}". Returning null.`);
      // } else {
      //   console.warn(`getFlightData (Glider): Supabase error for flight ${flightId} (Code: ${supabaseError.code}): ${supabaseError.message}. Details: ${supabaseError.details}. Hint: ${supabaseError.hint}. Returning null.`);
      // }
      return null;
    }

    // Condition 2: No Supabase error, but .single() found no data (which is valid for .single() if row doesn't exist or RLS blocks)
    if (!data) {
      // This is an expected case if the flightId doesn't exist or RLS prevents access without throwing a specific Supabase error object.
      // console.info(`getFlightData (Glider): No data returned for flight ${flightId} (and no Supabase error). Likely not found or RLS. Returning null.`);
      return null;
    }

    return data as CompletedGliderFlight;

  } catch (e: any) {
    // For truly unexpected errors during the try block (e.g., programming errors, network issues not caught by Supabase client)
    const errorMessage = e.message || "No specific message in caught exception.";
    console.error(`getFlightData (Glider): Unexpected JS exception while trying to fetch flight ${flightId}: ${errorMessage}.`);
    // Avoid logging the full 'e' object if it's too verbose or circular, focus on message and stack.
    // if (e.stack) console.error("getFlightData (Glider): Exception Stack:", e.stack);
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
