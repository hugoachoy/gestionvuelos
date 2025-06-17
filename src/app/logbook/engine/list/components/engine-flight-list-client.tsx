
"use client";

import React, { useEffect, useState } from 'react';
import { useCompletedEngineFlightsStore } from '@/store/data-hooks';
import type { CompletedEngineFlight } from '@/types';
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
import { RefreshCw, Trash2, Edit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePilotsStore, useAircraftStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export function EngineFlightListClient() {
  const { completedEngineFlights, loading: flightsLoading, error: flightsError, fetchCompletedEngineFlights, deleteCompletedEngineFlight } = useCompletedEngineFlightsStore();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isLoadingUI, setIsLoadingUI] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<CompletedEngineFlight | null>(null);


  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchCompletedEngineFlights();
  }, [fetchCompletedEngineFlights, fetchPilots, fetchAircraft]);

  useEffect(() => {
    setIsLoadingUI(flightsLoading || pilotsLoading || aircraftLoading || authLoading);
  }, [flightsLoading, pilotsLoading, aircraftLoading, authLoading]);

  const handleDeleteRequest = (flight: CompletedEngineFlight) => {
    setFlightToDelete(flight);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (flightToDelete) {
      const success = await deleteCompletedEngineFlight(flightToDelete.id);
      if (success) {
        toast({ title: "Vuelo Eliminado", description: "El registro del vuelo ha sido eliminado." });
      } else {
        toast({ title: "Error al Eliminar", description: "No se pudo eliminar el vuelo.", variant: "destructive" });
      }
    }
    setIsDeleteDialogOpen(false);
    setFlightToDelete(null);
  };

  const handleEditRequest = (flight: CompletedEngineFlight) => {
    router.push(`/logbook/engine/edit/${flight.id}`);
  };


  if (flightsError) {
    return (
      <div className="text-destructive">
        Error al cargar vuelos a motor: {flightsError.message}
        <Button onClick={() => fetchCompletedEngineFlights()} className="ml-2">Reintentar</Button>
      </div>
    );
  }

  const sortedFlights = [...completedEngineFlights].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return b.departure_time.localeCompare(a.departure_time);
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => fetchCompletedEngineFlights()} variant="outline" size="icon" disabled={isLoadingUI}>
          <RefreshCw className={cn("h-4 w-4", isLoadingUI && "animate-spin")} />
           <span className="sr-only">Refrescar vuelos</span>
        </Button>
      </div>

      {isLoadingUI && !sortedFlights.length ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
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
                <TableHead>Aeronave</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Propósito</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Llegada</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>A Facturar (min)</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Aterrizajes</TableHead>
                <TableHead>Remolques</TableHead>
                <TableHead>Aceite (Lts)</TableHead>
                <TableHead>Nafta (Lts)</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFlights.length === 0 && !isLoadingUI ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center h-24">
                    No hay vuelos a motor registrados.
                  </TableCell>
                </TableRow>
              ) : (
                sortedFlights.map((flight) => {
                  const canEdit = currentUser?.is_admin || (flight.auth_user_id && flight.auth_user_id === currentUser?.id);
                  const canDelete = currentUser?.is_admin;

                  return (
                    <TableRow key={flight.id}>
                      <TableCell>{format(parseISO(flight.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell>{getPilotName(flight.pilot_id)}</TableCell>
                      <TableCell>{getAircraftName(flight.engine_aircraft_id)}</TableCell>
                      <TableCell>{flight.instructor_id ? getPilotName(flight.instructor_id) : '-'}</TableCell>
                      <TableCell>{flight.flight_purpose}</TableCell>
                      <TableCell>{flight.departure_time}</TableCell>
                      <TableCell>{flight.arrival_time}</TableCell>
                      <TableCell>{flight.flight_duration_decimal.toFixed(1)} hs</TableCell>
                      <TableCell>
                        {flight.flight_purpose !== 'Remolque planeador' && typeof flight.billable_minutes === 'number'
                          ? `${flight.billable_minutes} min`
                          : '-'}
                      </TableCell>
                      <TableCell>{flight.route_from_to || '-'}</TableCell>
                      <TableCell>{flight.landings_count ?? '-'}</TableCell>
                      <TableCell>{flight.tows_count ?? '-'}</TableCell>
                      <TableCell>{flight.oil_added_liters ?? '-'}</TableCell>
                      <TableCell>{flight.fuel_added_liters ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => handleEditRequest(flight)} className="mr-2 hover:text-primary">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(flight)} className="hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={flightToDelete ? `el vuelo de ${getPilotName(flightToDelete.pilot_id)} del ${format(parseISO(flightToDelete.date), "dd/MM/yyyy")}` : 'este vuelo'}
      />
    </div>
  );
}
