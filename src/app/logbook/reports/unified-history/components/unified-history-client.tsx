
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePilotsStore, useAircraftStore, useCompletedEngineFlightsStore, useCompletedGliderFlightsStore, useFlightPurposesStore } from '@/store/data-hooks';
import type { CompletedFlight, CompletedEngineFlight, CompletedGliderFlight } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
import { CalendarIcon, FileText, Loader2, Check, ChevronsUpDown, Download } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function UnifiedHistoryClient() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { getPurposeName, loading: purposesLoading, fetchFlightPurposes } = useFlightPurposesStore();
  const { fetchCompletedEngineFlightsForRange, loading: engineLoading } = useCompletedEngineFlightsStore();
  const { fetchCompletedGliderFlightsForRange, loading: gliderLoading } = useCompletedGliderFlightsStore();

  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedPilotId, setSelectedPilotId] = useState<string>('all');
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [isPilotPickerOpen, setIsPilotPickerOpen] = useState(false);
  const [currentUserPilotId, setCurrentUserPilotId] = useState<string | null>(null);

  const [reportData, setReportData] = useState<CompletedFlight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

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
        setSelectedPilotId(foundPilot.id); // Auto-select current user
      }
    } else if (currentUser?.is_admin) {
        setSelectedPilotId('all');
    }
  }, [currentUser, pilots]);

  const handleGenerateReport = useCallback(async () => {
    if (!startDate || !endDate || !selectedPilotId) {
        toast({ title: "Faltan datos", description: "Por favor, seleccione piloto y un rango de fechas.", variant: "destructive" });
        return;
    }
    if (endDate < startDate) {
        toast({ title: "Rango Inválido", description: "La fecha de fin no puede ser anterior a la fecha de inicio.", variant: "destructive" });
        return;
    }
    
    setIsGenerating(true);
    setReportData([]);
    
    const pilotIdToFetch = currentUser?.is_admin ? (selectedPilotId === 'all' ? undefined : selectedPilotId) : currentUserPilotId;
    
    if (!currentUser?.is_admin && !pilotIdToFetch) {
        toast({ title: "Perfil no encontrado", description: "No se encontró un perfil de piloto asociado a tu usuario. No se pueden cargar vuelos.", variant: "destructive" });
        setIsGenerating(false);
        return;
    }

    const startDateStr = format(startDate, "yyyy-MM-dd");
    const endDateStr = format(endDate, "yyyy-MM-dd");

    const [engineFlights, gliderFlights] = await Promise.all([
        fetchCompletedEngineFlightsForRange(startDateStr, endDateStr, pilotIdToFetch),
        fetchCompletedGliderFlightsForRange(startDateStr, endDateStr, pilotIdToFetch)
    ]);

    if (engineFlights === null || gliderFlights === null) {
        toast({ title: "Error al generar informe", description: "No se pudieron obtener los datos de los vuelos.", variant: "destructive" });
        setIsGenerating(false);
        return;
    }

    const combinedFlights: CompletedFlight[] = [...engineFlights, ...gliderFlights];
    const sortedFlights = combinedFlights.sort((a, b) => {
        const dateComp = b.date.localeCompare(a.date);
        if (dateComp !== 0) return dateComp;
        return b.departure_time.localeCompare(a.departure_time);
    });

    setReportData(sortedFlights);

    if (sortedFlights.length === 0) {
      toast({ title: "Sin Resultados", description: "No se encontraron vuelos para los filtros seleccionados." });
    }

    setIsGenerating(false);
  }, [startDate, endDate, selectedPilotId, currentUser?.is_admin, currentUserPilotId, toast, fetchCompletedEngineFlightsForRange, fetchCompletedGliderFlightsForRange]);

  useEffect(() => {
    if (currentUser !== null && pilots.length > 0) { // Ensure user and pilots are loaded
        handleGenerateReport();
    }
  }, [startDate, endDate, selectedPilotId, handleGenerateReport, currentUser, pilots.length]);

  const isLoadingUI = authLoading || pilotsLoading || aircraftLoading || purposesLoading || engineLoading || gliderLoading || isGenerating;
  
  const [totalGliderHours, totalEngineHours] = useMemo(() => {
    let gliderHours = 0;
    let engineHours = 0;
    
    // To avoid double-counting instruction hours
    const processedFlightKeys = new Set<string>();

    reportData.forEach(flight => {
        const key = `${flight.date}-${flight.departure_time}-${(flight as CompletedEngineFlight).engine_aircraft_id || (flight as CompletedGliderFlight).glider_aircraft_id}`;
        if (processedFlightKeys.has(key)) return;

        const isInstruction = getPurposeName(flight.flight_purpose_id).includes('Instrucción');
        if (isInstruction) {
            processedFlightKeys.add(key);
        }

        if (flight.logbook_type === 'glider') {
            gliderHours += flight.flight_duration_decimal;
        } else {
            engineHours += flight.flight_duration_decimal;
        }
    });

    return [gliderHours.toFixed(1), engineHours.toFixed(1)];
  }, [reportData, getPurposeName]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-card flex-wrap">
        <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant={"outline"} className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !startDate && "text-muted-foreground")} disabled={isLoadingUI}>
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
            <Button variant={"outline"} className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !endDate && "text-muted-foreground")} disabled={isLoadingUI}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP", { locale: es }) : <span>Fecha de Fin</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setIsEndDatePickerOpen(false); }} disabled={(date) => startDate && date < startDate} initialFocus locale={es} />
          </PopoverContent>
        </Popover>
        
        <Popover open={isPilotPickerOpen} onOpenChange={setIsPilotPickerOpen}>
          <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className={cn("w-full sm:w-auto md:w-[240px] justify-between", !selectedPilotId && "text-muted-foreground")} disabled={isLoadingUI || !currentUser?.is_admin}>
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

        <Button onClick={handleGenerateReport} disabled={isLoadingUI} className="w-full sm:w-auto">
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Filtrar / Refrescar
        </Button>
      </div>

      {(isLoadingUI && !reportData.length) && (
         <div className="space-y-2 mt-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isLoadingUI && reportData.length > 0 && (
        <div className="overflow-x-auto rounded-lg border shadow-sm mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo Vuelo</TableHead>
                <TableHead>Aeronave</TableHead>
                <TableHead>Piloto</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Propósito</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((flight) => {
                 const purposeName = getPurposeName(flight.flight_purpose_id);
                 const isInstruction = purposeName.includes('Instrucción');
                 let pilotText = getPilotName(flight.pilot_id);
                 
                 // If the selected pilot is an instructor for this flight, show the student's name.
                 if (isInstruction && flight.instructor_id === selectedPilotId && selectedPilotId !== 'all') {
                    pilotText = `${getPilotName(flight.instructor_id)} (Instr. de ${getPilotName(flight.pilot_id)})`;
                 }

                return (
                <TableRow key={flight.id}>
                  <TableCell>{format(parseISO(flight.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell>
                    <Badge variant={flight.logbook_type === 'engine' ? 'default' : 'secondary'}>
                      {flight.logbook_type === 'engine' ? 'Motor' : 'Planeador'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getAircraftName(flight.logbook_type === 'engine' ? (flight as CompletedEngineFlight).engine_aircraft_id : (flight as CompletedGliderFlight).glider_aircraft_id)}</TableCell>
                  <TableCell>{pilotText}</TableCell>
                  <TableCell>{flight.instructor_id ? getPilotName(flight.instructor_id) : '-'}</TableCell>
                  <TableCell>{purposeName}</TableCell>
                  <TableCell>{flight.flight_duration_decimal.toFixed(1)} hs</TableCell>
                  <TableCell className="max-w-xs truncate">{flight.notes || '-'}</TableCell>
                </TableRow>
              )})}
            </TableBody>
            <TableFooter>
                <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={6} className="text-right">TOTAL HORAS</TableCell>
                    <TableCell>
                       <div className="flex flex-col">
                           <span>Motor: {totalEngineHours} hs</span>
                           <span>Planeador: {totalGliderHours} hs</span>
                       </div>
                    </TableCell>
                    <TableCell></TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
