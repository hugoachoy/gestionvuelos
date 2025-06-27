"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useCompletedEngineFlightsStore } from '@/store/data-hooks';
import type { CompletedEngineFlight } from '@/types';
import { FLIGHT_PURPOSE_DISPLAY_MAP } from '@/types';
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
import { RefreshCw, Trash2, Edit, CalendarIcon } from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePilotsStore, useAircraftStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


export function EngineFlightListClient() {
  const { fetchCompletedEngineFlightsForRange, loading: flightsLoading, error: flightsError, deleteCompletedEngineFlight } = useCompletedEngineFlightsStore();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [filteredFlights, setFilteredFlights] = useState<CompletedEngineFlight[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<CompletedEngineFlight | null>(null);

  const handleFetchAndFilter = useCallback(async () => {
    if (!startDate || !endDate) {
      toast({ title: "Fechas Requeridas", description: "Por favor, seleccione un rango de fechas.", variant: "destructive" });
      return;
    }
    if (endDate < startDate) {
        toast({ title: "Rango Inválido", description: "La fecha de fin no puede ser anterior a la fecha de inicio.", variant: "destructive" });
        return;
    }
    const data = await fetchCompletedEngineFlightsForRange(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), undefined);
    if (data) {
      setFilteredFlights(data);
      if (data.length === 0) {
        toast({ title: "Sin Resultados", description: "No se encontraron vuelos a motor para el rango seleccionado." });
      }
    }
  }, [startDate, endDate, fetchCompletedEngineFlightsForRange, toast]);

  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    handleFetchAndFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const isLoadingUI = flightsLoading || pilotsLoading || aircraftLoading || authLoading;

  const handleDeleteRequest = (flight: CompletedEngineFlight) => {
    setFlightToDelete(flight);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (flightToDelete) {
      const success = await deleteCompletedEngineFlight(flightToDelete.id);
      if (success) {
        toast({ title: "Vuelo Eliminado", description: "El registro del vuelo ha sido eliminado." });
        handleFetchAndFilter(); // Refetch
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
        <Button onClick={handleFetchAndFilter} className="ml-2">Reintentar</Button>
      </div>
    );
  }

  const sortedFlights = useMemo(() => {
    if (!filteredFlights) return [];
    return [...filteredFlights].sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return b.departure_time.localeCompare(a.departure_time);
    });
  }, [filteredFlights]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-card flex-wrap mb-4">
        <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}
              disabled={isLoadingUI}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP", { locale: es }) : <span>Fecha de Inicio</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setIsStartDatePickerOpen(false); }} initialFocus locale={es} />
          </PopoverContent>
        </Popover>

        <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}
              disabled={isLoadingUI}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP", { locale: es }) : <span>Fecha de Fin</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setIsEndDatePickerOpen(false); }} disabled={(date) => startDate && date < startDate} initialFocus locale={es} />
          </PopoverContent>
        </Popover>
        <Button onClick={handleFetchAndFilter} disabled={isLoadingUI}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingUI && "animate-spin")} />
          Filtrar / Refrescar
        </Button>
      </div>

      {isLoadingUI && !sortedFlights.length ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="w-full overflow-auto rounded-lg border shadow-sm max-h-[calc(100vh-20rem)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm">
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
                    No hay vuelos a motor para el rango seleccionado.
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
                      <TableCell>{FLIGHT_PURPOSE_DISPLAY_MAP[flight.flight_purpose as keyof typeof FLIGHT_PURPOSE_DISPLAY_MAP] || flight.flight_purpose}</TableCell>
                      <TableCell>{flight.departure_time}</TableCell>
                      <TableCell>{flight.arrival_time}</TableCell>
                      <TableCell>{flight.flight_duration_decimal.toFixed(1)} hs</TableCell>
                      <TableCell>
                        {flight.flight_purpose !== 'remolque' && typeof flight.billable_minutes === 'number'
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
