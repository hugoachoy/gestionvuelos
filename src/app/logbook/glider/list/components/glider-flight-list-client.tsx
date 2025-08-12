
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useCompletedGliderFlightsStore, useFlightPurposesStore } from '@/store/data-hooks';
import type { CompletedGliderFlight } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Trash2, Edit, CalendarIcon, Check, ChevronsUpDown, Download } from 'lucide-react';
import { format, parseISO, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePilotsStore, useAircraftStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function GliderFlightListClient() {
  const { fetchCompletedGliderFlightsForRange, loading: flightsLoading, error: flightsError, deleteCompletedGliderFlight } = useCompletedGliderFlightsStore();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { getPurposeName, purposes, loading: purposesLoading, fetchFlightPurposes } = useFlightPurposesStore();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [startDate, setStartDate] = useState<Date | undefined>(subYears(new Date(), 1));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedPilotId, setSelectedPilotId] = useState<string>('all');
  const [currentUserPilotId, setCurrentUserPilotId] = useState<string | null>(null);

  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [isPilotPickerOpen, setIsPilotPickerOpen] = useState(false);
  
  const [filteredFlights, setFilteredFlights] = useState<CompletedGliderFlight[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<CompletedGliderFlight | null>(null);

  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchFlightPurposes();
  }, [fetchPilots, fetchAircraft, fetchFlightPurposes]);

  useEffect(() => {
    if (currentUser && !currentUser.is_admin && pilots.length > 0) {
      const foundPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      if (foundPilot) {
        setCurrentUserPilotId(foundPilot.id);
      }
    }
  }, [currentUser, pilots]);

  const handleFetchAndFilter = useCallback(async () => {
    if (!startDate || !endDate) {
      toast({ title: "Fechas Requeridas", description: "Por favor, seleccione un rango de fechas.", variant: "destructive" });
      return;
    }
    if (endDate < startDate) {
        toast({ title: "Rango Inválido", description: "La fecha de fin no puede ser anterior a la fecha de inicio.", variant: "destructive" });
        return;
    }
    
    const pilotIdToFetch = currentUser?.is_admin ? (selectedPilotId === 'all' ? undefined : selectedPilotId) : currentUserPilotId;

    if (!currentUser?.is_admin && !pilotIdToFetch) {
        toast({ title: "Perfil no encontrado", description: "No se encontró un perfil de piloto asociado a tu usuario. No se pueden cargar vuelos.", variant: "destructive" });
        setFilteredFlights([]);
        return;
    }

    const data = await fetchCompletedGliderFlightsForRange(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), pilotIdToFetch);
    if (data) {
      const flightsToSet = data;
      setFilteredFlights(flightsToSet);

      if (flightsToSet.length === 0) {
        toast({ title: "Sin Resultados", description: "No se encontraron vuelos de planeador para los filtros seleccionados." });
      }
    }
  }, [startDate, endDate, fetchCompletedGliderFlightsForRange, toast, currentUser?.is_admin, selectedPilotId, currentUserPilotId]);

  useEffect(() => {
    if (startDate && endDate) {
      if (currentUser?.is_admin) {
        handleFetchAndFilter();
      } else if (currentUserPilotId) {
        handleFetchAndFilter();
      }
    }
  }, [startDate, endDate, currentUserPilotId, currentUser?.is_admin, handleFetchAndFilter]);


  const isLoadingUI = flightsLoading || pilotsLoading || aircraftLoading || authLoading || purposesLoading;

  const handleDeleteRequest = (flight: CompletedGliderFlight) => {
    setFlightToDelete(flight);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (flightToDelete) {
      const success = await deleteCompletedGliderFlight(flightToDelete.id);
      if (success) {
        toast({ title: "Vuelo Eliminado", description: "El registro del vuelo ha sido eliminado." });
        handleFetchAndFilter(); // Refetch data for the current range
      } else {
        toast({ title: "Error al Eliminar", description: "No se pudo eliminar el vuelo.", variant: "destructive" });
      }
    }
    setIsDeleteDialogOpen(false);
    setFlightToDelete(null);
  };

  const handleEditRequest = (flight: CompletedGliderFlight) => {
    router.push(`/logbook/glider/edit/${flight.id}`);
  };

  const sortedFlights = useMemo(() => {
    if (!filteredFlights) return [];
    return [...filteredFlights].sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return b.departure_time.localeCompare(a.departure_time);
    });
  }, [filteredFlights]);

  const totalHours = useMemo(() => {
    if (!sortedFlights || sortedFlights.length === 0) return 0;

    const processedFlightKeys = new Set<string>();
    let totalDuration = 0;

    for (const flight of sortedFlights) {
        // A unique key for a flight event, ignoring who logged it
        const flightEventKey = `${flight.date}-${flight.departure_time}-${flight.arrival_time}-${flight.glider_aircraft_id}`;
        
        if (!processedFlightKeys.has(flightEventKey)) {
            totalDuration += flight.flight_duration_decimal;
            processedFlightKeys.add(flightEventKey);
        }
    }
    
    return totalDuration;
  }, [sortedFlights]);

  const handleExportPdf = async () => {
    if (sortedFlights.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos para exportar.", variant: "default" });
      return;
    }
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF({ orientation: 'landscape' });
    
    const pilotIdForTitle = currentUser?.is_admin ? selectedPilotId : currentUserPilotId;
    const pilotNameForTitle = pilotIdForTitle === 'all' ? 'Todos los Pilotos' : getPilotName(pilotIdForTitle);
    const pageTitle = `Historial de Vuelos en Planeador: ${pilotNameForTitle}`;
    const pageSubtitle = `Período: ${startDate ? format(startDate, "dd/MM/yy") : ''} - ${endDate ? format(endDate, "dd/MM/yy") : ''}`;

    doc.setFontSize(16);
    doc.text(pageTitle, 14, 15);
    doc.setFontSize(10);
    doc.text(pageSubtitle, 14, 22);

    const tableColumn = ["Fecha", "Piloto", "Planeador", "Instructor", "Propósito", "Piloto Rem.", "Avión Rem.", "Salida", "Llegada", "Duración", "Notas"];
    const tableRows: (string | null)[][] = [];
    
    const flightsForPdf = [...sortedFlights].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.departure_time.localeCompare(b.departure_time);
    });

    flightsForPdf.forEach(flight => {
        const purposeName = getPurposeName(flight.flight_purpose_id);
        const isInstructionGiven = purposeName.includes('Impartida');

        tableRows.push([
            format(parseISO(flight.date), "dd/MM/yyyy", { locale: es }),
            isInstructionGiven ? getPilotName(flight.instructor_id) : getPilotName(flight.pilot_id),
            getAircraftName(flight.glider_aircraft_id),
            isInstructionGiven ? getPilotName(flight.pilot_id) : (flight.instructor_id ? getPilotName(flight.instructor_id) : '-'),
            purposeName,
            flight.tow_pilot_id ? getPilotName(flight.tow_pilot_id) : '-',
            flight.tow_aircraft_id ? getAircraftName(flight.tow_aircraft_id) : '-',
            flight.departure_time.substring(0, 5),
            flight.arrival_time.substring(0, 5),
            `${flight.flight_duration_decimal.toFixed(1)} hs`,
            flight.notes || '-',
        ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [[
          { content: 'TOTAL', colSpan: 9, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${totalHours.toFixed(1)} hs`, styles: { fontStyle: 'bold' } },
          { content: '', colSpan: 1 },
      ]],
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [30, 100, 160], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 1.5, fontStyle: 'bold' },
      columnStyles: {
          0: { cellWidth: 18 }, // Fecha
          1: { cellWidth: 'auto' }, // Piloto
          2: { cellWidth: 'auto' }, // Planeador
          3: { cellWidth: 'auto' }, // Instructor
          4: { cellWidth: 25 }, // Propósito
          5: { cellWidth: 'auto' }, // Piloto Rem
          6: { cellWidth: 'auto' }, // Avion Rem
          7: { cellWidth: 14 }, // Salida
          8: { cellWidth: 14 }, // Llegada
          9: { cellWidth: 16 }, // Duracion
          10: { cellWidth: 'auto' }, // Notas
      },
    });

    const fileName = `historial_planeador_${pilotIdForTitle === 'all' ? 'todos' : getPilotName(pilotIdForTitle).replace(/\s/g, '_')}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(fileName);
    toast({ title: "PDF Exportado", description: `El historial se ha guardado como ${fileName}.` });
  };


  if (flightsError) {
    return (
      <div className="text-destructive">
        Error al cargar vuelos en planeador: {flightsError.message}
        <Button onClick={handleFetchAndFilter} className="ml-2">Reintentar</Button>
      </div>
    );
  }

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
        
        {currentUser?.is_admin && (
           <Popover open={isPilotPickerOpen} onOpenChange={setIsPilotPickerOpen}>
              <PopoverTrigger asChild>
                  <Button
                  variant="outline"
                  role="combobox"
                  className={cn("w-full sm:w-auto md:w-[240px] justify-between", !selectedPilotId && "text-muted-foreground")}
                  disabled={isLoadingUI}
                  >
                  {selectedPilotId === 'all' ? 'Todos los Pilotos' : getPilotName(selectedPilotId)}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                      <CommandInput placeholder="Buscar piloto..." />
                      <CommandList>
                          <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                          <CommandGroup>
                              <CommandItem value="all" onSelect={() => { setSelectedPilotId('all'); setIsPilotPickerOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", selectedPilotId === 'all' ? "opacity-100" : "opacity-0")} />
                                  Todos los Pilotos
                              </CommandItem>
                              {pilots.map(pilot => (
                                  <CommandItem key={pilot.id} value={`${pilot.last_name}, ${pilot.first_name}`} onSelect={() => { setSelectedPilotId(pilot.id); setIsPilotPickerOpen(false); }}>
                                      <Check className={cn("mr-2 h-4 w-4", selectedPilotId === pilot.id ? "opacity-100" : "opacity-0")} />
                                      {pilot.last_name}, {pilot.first_name}
                                  </CommandItem>
                              ))}
                          </CommandGroup>
                      </CommandList>
                  </Command>
              </PopoverContent>
           </Popover>
        )}

        <Button onClick={handleFetchAndFilter} disabled={isLoadingUI}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingUI && "animate-spin")} />
          Filtrar / Refrescar
        </Button>
         {sortedFlights.length > 0 && !isLoadingUI && (
            <Button onClick={handleExportPdf} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar a PDF
            </Button>
        )}
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
                <TableHead>Piloto</TableHead>
                <TableHead>Planeador</TableHead>
                <TableHead>Instructor/Alumno</TableHead>
                <TableHead>Piloto Rem.</TableHead>
                <TableHead>Avión Rem.</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Llegada</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Propósito</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFlights.length === 0 && !isLoadingUI ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center h-24">
                    No hay vuelos en planeador para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                sortedFlights.map((flight) => {
                  const canEdit = currentUser?.is_admin || (flight.auth_user_id && flight.auth_user_id === currentUser?.id);
                  const canDelete = currentUser?.is_admin;
                  const purposeName = getPurposeName(flight.flight_purpose_id);
                  const isInstructionGiven = purposeName.includes('Impartida');

                  return (
                    <TableRow key={flight.id}>
                      <TableCell>{format(parseISO(flight.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell>{isInstructionGiven ? getPilotName(flight.instructor_id) : getPilotName(flight.pilot_id)}</TableCell>
                      <TableCell>{getAircraftName(flight.glider_aircraft_id)}</TableCell>
                      <TableCell>{isInstructionGiven ? getPilotName(flight.pilot_id) : (flight.instructor_id ? getPilotName(flight.instructor_id) : '-')}</TableCell>
                      <TableCell>{flight.tow_pilot_id ? getPilotName(flight.tow_pilot_id) : '-'}</TableCell>
                      <TableCell>{flight.tow_aircraft_id ? getAircraftName(flight.tow_aircraft_id) : '-'}</TableCell>
                      <TableCell>{flight.departure_time.substring(0, 5)}</TableCell>
                      <TableCell>{flight.arrival_time.substring(0, 5)}</TableCell>
                      <TableCell>{flight.flight_duration_decimal.toFixed(1)} hs</TableCell>
                      <TableCell>{purposeName}</TableCell>
                      <TableCell>{flight.notes || '-'}</TableCell>
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
             {sortedFlights.length > 0 && (
              <TableFooter>
                <TableRow>
                    <TableCell colSpan={8} className="text-right font-bold">TOTAL HORAS</TableCell>
                    <TableCell className="font-bold">
                        {totalHours.toFixed(1)} hs
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                </TableRow>
              </TableFooter>
            )}
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
