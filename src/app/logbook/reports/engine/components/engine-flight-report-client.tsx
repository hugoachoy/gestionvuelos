
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useCompletedEngineFlightsStore, usePilotsStore, useAircraftStore, useFlightPurposesStore } from '@/store/data-hooks';
import type { CompletedEngineFlight } from '@/types';
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
import { CalendarIcon, Download, FileText, Loader2, Check, ChevronsUpDown, FileSpreadsheet } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';

export function EngineFlightReportClient() {
  const { fetchCompletedEngineFlightsForRange, loading: flightsLoading, error: flightsError } = useCompletedEngineFlightsStore();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { getPurposeName, purposes, loading: purposesLoading, fetchFlightPurposes } = useFlightPurposesStore();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedPilotId, setSelectedPilotId] = useState<string>('all');
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [isPilotPickerOpen, setIsPilotPickerOpen] = useState(false);
  const [reportData, setReportData] = useState<CompletedEngineFlight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentUserPilotId, setCurrentUserPilotId] = useState<string | null>(null);

  const [totalDuration, setTotalDuration] = useState(0);
  const [totalBillableMinutes, setTotalBillableMinutes] = useState(0);
  const [totalLandings, setTotalLandings] = useState(0);


  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchFlightPurposes();
  }, [fetchPilots, fetchAircraft, fetchFlightPurposes]);

  useEffect(() => {
    if (currentUser && !currentUser.is_admin && pilots.length > 0) {
      const foundPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      setCurrentUserPilotId(foundPilot?.id || null);
    }
  }, [currentUser, pilots]);

  const handleGenerateReport = useCallback(async () => {
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
        toast({ title: "Perfil no encontrado", description: "No se encontró un perfil de piloto asociado a tu usuario.", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setReportData([]);
    setTotalDuration(0);
    setTotalBillableMinutes(0);
    setTotalLandings(0);

    const data = await fetchCompletedEngineFlightsForRange(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), pilotIdToFetch);
    
    if (data) {
      let duration = 0;
      let billableMins = 0;
      let landings = 0;
      const remolquePurposeName = "Remolque planeador";

      data.forEach(flight => {
        duration += flight.flight_duration_decimal || 0;
        const purposeName = getPurposeName(flight.flight_purpose_id);
        if (purposeName !== remolquePurposeName) {
            billableMins += flight.billable_minutes || 0;
        }
        landings += flight.landings_count || 0;
      });

      setTotalDuration(duration);
      setTotalBillableMinutes(billableMins);
      setTotalLandings(landings);
      setReportData(data);

      if (data.length === 0) {
        toast({ title: "Sin Resultados", description: "No se encontraron vuelos a motor para los filtros seleccionados." });
      }
    } else {
      toast({ title: "Error al Generar", description: "No se pudo obtener el informe.", variant: "destructive" });
    }
    setIsGenerating(false);
  }, [startDate, endDate, fetchCompletedEngineFlightsForRange, toast, currentUser?.is_admin, selectedPilotId, currentUserPilotId, getPurposeName]);
  
  const handleExportPdf = async () => {
    if (reportData.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos para exportar.", variant: "default" });
      return;
    }
    setIsGenerating(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF({ orientation: 'landscape' });
      
      const pilotIdForTitle = currentUser?.is_admin ? selectedPilotId : currentUserPilotId;
      const selectedPilot = pilots.find(p => p.id === pilotIdForTitle);
      const pilotNameForTitle = selectedPilot ? `de ${selectedPilot.first_name} ${selectedPilot.last_name}` : 'de Todos los Pilotos';

      const pageTitle = `Informe de Vuelos a Motor ${pilotNameForTitle} (${startDate ? format(startDate, "dd/MM/yy") : ''} - ${endDate ? format(endDate, "dd/MM/yy") : ''})`;
      let currentY = 15;

      doc.setFontSize(16);
      doc.text(pageTitle, 14, currentY);
      currentY += 10;

      const tableColumn = ["Fecha", "Piloto", "Aeronave", "Instructor", "Propósito", "Salida", "Llegada", "Duración", "Facturable", "Ruta", "Aterrizajes", "Remolques", "Aceite (L)", "Nafta (L)", "Notas"];
      const tableRows: (string | null)[][] = [];
      const remolquePurposeName = "Remolque planeador";

      reportData.forEach(flight => {
        const purposeName = getPurposeName(flight.flight_purpose_id);
        tableRows.push([
          format(parseISO(flight.date), "dd/MM/yyyy", { locale: es }),
          getPilotName(flight.pilot_id),
          getAircraftName(flight.engine_aircraft_id),
          flight.instructor_id ? getPilotName(flight.instructor_id) : '-',
          purposeName,
          flight.departure_time,
          flight.arrival_time,
          `${flight.flight_duration_decimal.toFixed(1)} hs`,
          purposeName !== remolquePurposeName && typeof flight.billable_minutes === 'number' ? `${flight.billable_minutes} min` : '-',
          flight.route_from_to || '-',
          flight.landings_count?.toString() ?? '-',
          flight.tows_count?.toString() ?? '-',
          flight.oil_added_liters?.toString() ?? '-',
          flight.fuel_added_liters?.toString() ?? '-',
          flight.notes || '-',
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [[
            { content: 'TOTALES', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: `${totalDuration.toFixed(1)} hs`, styles: { fontStyle: 'bold' } },
            { content: `${totalBillableMinutes} min`, styles: { fontStyle: 'bold' } },
            { content: '' }, // Ruta
            { content: totalLandings.toString(), styles: { fontStyle: 'bold' } },
            { content: '' }, { content: '' }, { content: '' }, { content: '' },
        ]],
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [30, 100, 160], textColor: 255 },
        styles: { fontSize: 7, cellPadding: 1 },
        columnStyles: {
            0: { cellWidth: 16 }, // Fecha
            1: { cellWidth: 'auto' }, // Piloto
            2: { cellWidth: 'auto' }, // Aeronave
            3: { cellWidth: 'auto' }, // Instructor
            4: { cellWidth: 20 }, // Propósito
            5: { cellWidth: 12 }, // Salida
            6: { cellWidth: 12 }, // Llegada
            7: { cellWidth: 13 }, // Duración
            8: { cellWidth: 16 }, // Facturable
            9: { cellWidth: 25 }, // Ruta
            10: { cellWidth: 15 }, // Aterrizajes
            11: { cellWidth: 15 }, // Remolques
            12: { cellWidth: 15 }, // Aceite
            13: { cellWidth: 15 }, // Nafta
            14: { cellWidth: 30 }, // Notas
        },
      });
      
      const pilotFileNamePart = selectedPilot ? `${selectedPilot.last_name}_${selectedPilot.first_name}`.toLowerCase() : 'todos';
      const fileName = `informe_motor_${pilotFileNamePart}_${startDate ? format(startDate, "yyyyMMdd") : 'inicio'}_a_${endDate ? format(endDate, "yyyyMMdd") : 'fin'}.pdf`;
      doc.save(fileName);
      toast({ title: "PDF Exportado", description: `El informe se ha guardado como ${fileName}.` });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error de Exportación", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportCsv = useCallback(() => {
    if (reportData.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos para exportar.", variant: "default" });
      return;
    }
    setIsGenerating(true);
    try {
        const headers = ["Fecha", "Piloto", "Aeronave", "Instructor", "Proposito", "Salida", "Llegada", "Duracion (hs)", "Facturable (min)", "Ruta", "Aterrizajes", "Remolques", "Aceite (L)", "Nafta (L)", "Notas"];
        const csvRows = [headers.join(',')];
        const remolquePurposeName = "Remolque planeador";

        reportData.forEach(flight => {
            const purposeName = getPurposeName(flight.flight_purpose_id);
            const row = [
                format(parseISO(flight.date), "dd/MM/yyyy", { locale: es }),
                `"${getPilotName(flight.pilot_id)?.replace(/"/g, '""')}"`,
                `"${getAircraftName(flight.engine_aircraft_id)?.replace(/"/g, '""')}"`,
                `"${flight.instructor_id ? getPilotName(flight.instructor_id)?.replace(/"/g, '""') : '-'}"`,
                `"${purposeName.replace(/"/g, '""')}"`,
                flight.departure_time,
                flight.arrival_time,
                flight.flight_duration_decimal.toFixed(1),
                purposeName !== remolquePurposeName && typeof flight.billable_minutes === 'number' ? flight.billable_minutes : '-',
                `"${(flight.route_from_to || '-').replace(/"/g, '""')}"`,
                flight.landings_count?.toString() ?? '-',
                flight.tows_count?.toString() ?? '-',
                flight.oil_added_liters?.toString() ?? '-',
                flight.fuel_added_liters?.toString() ?? '-',
                `"${(flight.notes || '-').replace(/"/g, '""')}"`,
            ];
            csvRows.push(row.join(','));
        });

        csvRows.push('\n');
        const totalsRow = [
            "TOTALES", "", "", "", "", "", "",
            totalDuration.toFixed(1),
            totalBillableMinutes.toString(),
            "",
            totalLandings.toString(),
            "", "", "", ""
        ];
        csvRows.push(totalsRow.join(','));


        const csvContent = "ufeff" + csvRows.join('\n'); // Add UTF-8 BOM
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");

        const pilotIdForTitle = currentUser?.is_admin ? selectedPilotId : currentUserPilotId;
        const selectedPilot = pilots.find(p => p.id === pilotIdForTitle);
        const pilotFileNamePart = selectedPilot ? `${selectedPilot.last_name}_${selectedPilot.first_name}`.toLowerCase() : 'todos';
        const fileName = `informe_motor_${pilotFileNamePart}_${startDate ? format(startDate, "yyyyMMdd") : 'inicio'}_a_${endDate ? format(endDate, "yyyyMMdd") : 'fin'}.csv`;
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: "CSV Exportado", description: `El informe se ha guardado como ${fileName}.` });
        } else {
            toast({ title: "Error de Exportación", description: "Tu navegador no soporta la descarga de archivos.", variant: "destructive"});
        }
    } catch (error) {
      console.error("Error generating CSV:", error);
      toast({ title: "Error de Exportación", description: "No se pudo generar el CSV.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [reportData, toast, getPilotName, getAircraftName, getPurposeName, currentUser?.is_admin, selectedPilotId, currentUserPilotId, pilots, startDate, endDate, totalDuration, totalBillableMinutes, totalLandings]);


  const isLoadingUI = authLoading || flightsLoading || pilotsLoading || aircraftLoading || purposesLoading || isGenerating;

  if (flightsError) {
    return <div className="text-destructive">Error al cargar datos para el informe: {flightsError.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-card flex-wrap">
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

        <Button onClick={handleGenerateReport} disabled={isLoadingUI || !startDate || !endDate} className="w-full sm:w-auto">
          {isLoadingUI && isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Generar Informe
        </Button>
         {reportData.length > 0 && (
            <>
                <Button onClick={handleExportPdf} variant="outline" disabled={isLoadingUI} className="w-full sm:w-auto">
                    {isLoadingUI && isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Exportar a PDF
                </Button>
                <Button onClick={handleExportCsv} variant="outline" disabled={isLoadingUI} className="w-full sm:w-auto">
                    {isLoadingUI && isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                    Exportar a CSV
                </Button>
            </>
        )}
      </div>

      {isLoadingUI && !reportData.length && (
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
                <TableHead>Piloto</TableHead>
                <TableHead>Aeronave</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Propósito</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Llegada</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>A Facturar</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Aterrizajes</TableHead>
                <TableHead>Remolques</TableHead>
                <TableHead>Aceite (Lts)</TableHead>
                <TableHead>Nafta (Lts)</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((flight) => {
                const purposeName = getPurposeName(flight.flight_purpose_id);
                return (
                <TableRow key={flight.id}>
                  <TableCell>{format(parseISO(flight.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell>{getPilotName(flight.pilot_id)}</TableCell>
                  <TableCell>{getAircraftName(flight.engine_aircraft_id)}</TableCell>
                  <TableCell>{flight.instructor_id ? getPilotName(flight.instructor_id) : '-'}</TableCell>
                  <TableCell>{purposeName}</TableCell>
                  <TableCell>{flight.departure_time}</TableCell>
                  <TableCell>{flight.arrival_time}</TableCell>
                  <TableCell>{flight.flight_duration_decimal.toFixed(1)} hs</TableCell>
                  <TableCell>
                    {purposeName !== 'Remolque planeador' && typeof flight.billable_minutes === 'number'
                      ? `${flight.billable_minutes} min`
                      : '-'}
                  </TableCell>
                  <TableCell>{flight.route_from_to || '-'}</TableCell>
                  <TableCell>{flight.landings_count ?? '-'}</TableCell>
                  <TableCell>{flight.tows_count ?? '-'}</TableCell>
                  <TableCell>{flight.oil_added_liters ?? '-'}</TableCell>
                  <TableCell>{flight.fuel_added_liters ?? '-'}</TableCell>
                  <TableCell>{flight.notes || '-'}</TableCell>
                </TableRow>
              )})}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={7} className="text-right font-bold">TOTALES</TableCell>
                    <TableCell className="font-bold">{totalDuration.toFixed(1)} hs</TableCell>
                    <TableCell className="font-bold">{totalBillableMinutes} min</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="font-bold">{totalLandings}</TableCell>
                    <TableCell colSpan={4}></TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      {!isLoadingUI && !isGenerating && reportData.length === 0 && startDate && endDate && (
        <div className="text-center text-muted-foreground mt-4 p-4 border rounded-lg">
          No se encontraron vuelos a motor para los filtros seleccionados.
        </div>
      )}
    </div>
  );
}


