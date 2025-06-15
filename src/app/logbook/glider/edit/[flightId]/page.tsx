
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
      const message = supabaseError.message;
      const code = supabaseError.code;
      const details = supabaseError.details;
      const hint = supabaseError.hint;

      let logMessage = `Supabase error fetching glider flight ${flightId}:`;
      if (typeof message === 'string' && message.trim() !== '') {
        logMessage += ` ${message}`;
      } else {
        logMessage += ` No specific message.`;
      }
      if (code) logMessage += ` (Code: ${code})`;
      
      console.error(logMessage);

      if (details) console.error(`Supabase Details: ${details}`);
      if (hint) console.error(`Supabase Hint: ${hint}`);
      
      if (!(typeof message === 'string' && message.trim() !== '')) {
        console.error("Full Supabase error object (as message was empty):", supabaseError);
      }
      return null;
    }
    return data as CompletedGliderFlight;

  } catch (e: any) {
    const errorMessage = e.message || "No specific message in caught exception.";
    console.error(`Unexpected exception while trying to fetch glider flight ${flightId}: ${errorMessage}.`);
    if (e.stack) console.error("Exception Stack:", e.stack);
    console.error("Full exception object:", e);
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
