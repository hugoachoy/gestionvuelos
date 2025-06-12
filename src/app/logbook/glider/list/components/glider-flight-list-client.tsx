
"use client";

import React, { useEffect, useState } from 'react';
import { useCompletedGliderFlightsStore } from '@/store/data-hooks';
import type { CompletedGliderFlight } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePilotsStore, useAircraftStore } from '@/store/data-hooks';
import { cn } from '@/lib/utils';

export function GliderFlightListClient() {
  const { completedGliderFlights, loading: flightsLoading, error: flightsError, fetchCompletedGliderFlights } = useCompletedGliderFlightsStore();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  
  const [isLoadingUI, setIsLoadingUI] = useState(true);

  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchCompletedGliderFlights();
  }, [fetchCompletedGliderFlights, fetchPilots, fetchAircraft]);
  
  useEffect(() => {
    // Consolidate loading states for UI
    setIsLoadingUI(flightsLoading || pilotsLoading || aircraftLoading);
  }, [flightsLoading, pilotsLoading, aircraftLoading]);


  if (flightsError) {
    return (
      <div className="text-destructive">
        Error al cargar vuelos en planeador: {flightsError.message}
        <Button onClick={() => fetchCompletedGliderFlights()} className="ml-2">Reintentar</Button>
      </div>
    );
  }
  
  const sortedFlights = [...completedGliderFlights].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date); // Sort by date descending
    if (dateComp !== 0) return dateComp;
    return b.departure_time.localeCompare(a.departure_time); // Then by departure time descending
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => fetchCompletedGliderFlights()} variant="outline" size="icon" disabled={isLoadingUI}>
          <RefreshCw className={cn("h-4 w-4", isLoadingUI && "animate-spin")} />
           <span className="sr-only">Refrescar vuelos</span>
        </Button>
      </div>

      {isLoadingUI && !sortedFlights.length ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" /> {/* Header row */}
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Piloto (PIC)</TableHead>
                <TableHead>Planeador</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Piloto Rem.</TableHead>
                <TableHead>Avión Rem.</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Llegada</TableHead>
                <TableHead>Duración (Dec)</TableHead>
                <TableHead>Propósito</TableHead>
                {/* <TableHead className="text-right">Acciones</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFlights.length === 0 && !isLoadingUI ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center h-24">
                    No hay vuelos en planeador registrados.
                  </TableCell>
                </TableRow>
              ) : (
                sortedFlights.map((flight) => (
                  <TableRow key={flight.id}>
                    <TableCell>{format(parseISO(flight.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell>{getPilotName(flight.pilot_id)}</TableCell>
                    <TableCell>{getAircraftName(flight.glider_aircraft_id)}</TableCell>
                    <TableCell>{flight.instructor_id ? getPilotName(flight.instructor_id) : '-'}</TableCell>
                    <TableCell>{flight.tow_pilot_id ? getPilotName(flight.tow_pilot_id) : '-'}</TableCell>
                    <TableCell>{flight.tow_aircraft_id ? getAircraftName(flight.tow_aircraft_id) : '-'}</TableCell>
                    <TableCell>{flight.departure_time}</TableCell>
                    <TableCell>{flight.arrival_time}</TableCell>
                    <TableCell>{flight.flight_duration_decimal.toFixed(1)} hs</TableCell>
                    <TableCell>{flight.flight_purpose}</TableCell>
                    {/* <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="mr-2 hover:text-primary">
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </TableCell> */}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
