
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePilotsStore, useAircraftStore, useCompletedEngineFlightsStore, useCompletedGliderFlightsStore, useFlightPurposesStore } from '@/store/data-hooks';
import type { CompletedEngineFlight, CompletedGliderFlight } from '@/types';
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
  TableCaption,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarIcon, FileText, Loader2, Check, ChevronsUpDown, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Local helper for logging errors
function logSupabaseError(context: string, error: any) {
  console.error(`${context}:`, error);
}

type BillableItem = {
  id: string;
  date: string;
  type: 'Vuelo a Motor' | 'Remolque de Planeador' | 'Instrucción Impartida';
  aircraft: string;
  duration_hs: number;
  billable_minutes: number | null;
  notes: string;
  is_non_billable_for_pilot?: boolean;
};

export function BillingReportClient() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { getPurposeName, purposes, loading: purposesLoading, fetchFlightPurposes } = useFlightPurposesStore();
  const { fetchCompletedEngineFlightsForRange } = useCompletedEngineFlightsStore();
  const { fetchCompletedGliderFlightsForRange } = useCompletedGliderFlightsStore();


  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedPilotId, setSelectedPilotId] = useState<string>('');
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [isPilotPickerOpen, setIsPilotPickerOpen] = useState(false);

  const [reportData, setReportData] = useState<BillableItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [totalBillableMinutes, setTotalBillableMinutes] = useState(0);
  const [totalTows, setTotalTows] = useState(0);

  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchFlightPurposes();
  }, [fetchPilots, fetchAircraft, fetchFlightPurposes]);

  // Auto-select pilot for non-admins
  useEffect(() => {
      if (currentUser && !currentUser.is_admin && pilots.length > 0) {
          const userPilot = pilots.find(p => p.auth_user_id === currentUser.id);
          if (userPilot) {
              setSelectedPilotId(userPilot.id);
          }
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
    setTotalBillableMinutes(0);
    setTotalTows(0);
    
    try {
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const [engineFlights, gliderFlights] = await Promise.all([
          fetchCompletedEngineFlightsForRange(startDateStr, endDateStr, selectedPilotId),
          fetchCompletedGliderFlightsForRange(startDateStr, endDateStr, selectedPilotId)
      ]);
      
      if (engineFlights === null || gliderFlights === null) {
          toast({ title: "Error al generar informe", description: "No se pudieron obtener los datos de los vuelos.", variant: "destructive" });
          setIsGenerating(false);
          return;
      }

      const billableItems: BillableItem[] = [];
      let totalMins = 0;
      let totalTowsCount = 0;
      
      const remolquePurposeName = "Remolque planeador";
      const instruccionImpartidaPurposeName = "Instrucción (Impartida)";
      
      engineFlights.forEach((flight) => {
        const purposeName = getPurposeName(flight.flight_purpose_id);

        if (purposeName === instruccionImpartidaPurposeName && flight.pilot_id === selectedPilotId) {
           billableItems.push({
            id: `eng-inst-${flight.id}`,
            date: flight.date,
            type: 'Instrucción Impartida',
            aircraft: getAircraftName(flight.engine_aircraft_id),
            duration_hs: flight.flight_duration_decimal,
            billable_minutes: null,
            notes: `(No facturable para ud.)`,
            is_non_billable_for_pilot: true
          });
        } else if (flight.pilot_id === selectedPilotId) {
            billableItems.push({
                id: `eng-${flight.id}`,
                date: flight.date,
                type: 'Vuelo a Motor',
                aircraft: getAircraftName(flight.engine_aircraft_id),
                duration_hs: flight.flight_duration_decimal,
                billable_minutes: flight.billable_minutes ?? 0,
                notes: `Propósito: ${purposeName}`,
                is_non_billable_for_pilot: false
            });
            if (purposeName !== remolquePurposeName) {
                totalMins += flight.billable_minutes ?? 0;
            }
        }
      });
      
      gliderFlights.forEach((flight) => {
          const purposeName = getPurposeName(flight.flight_purpose_id);

          if (purposeName === instruccionImpartidaPurposeName && flight.pilot_id === selectedPilotId) {
            billableItems.push({
              id: `gli-inst-${flight.id}`,
              date: flight.date,
              type: 'Instrucción Impartida',
              aircraft: getAircraftName(flight.glider_aircraft_id),
              duration_hs: flight.flight_duration_decimal,
              billable_minutes: null, 
              notes: `(No facturable para ud.)`,
              is_non_billable_for_pilot: true
            });
          } else if (flight.pilot_id === selectedPilotId) {
            billableItems.push({
              id: `gli-${flight.id}`,
              date: flight.date,
              type: 'Remolque de Planeador',
              aircraft: getAircraftName(flight.glider_aircraft_id),
              duration_hs: flight.flight_duration_decimal,
              billable_minutes: null,
              notes: `Remolcado por: ${getPilotName(flight.tow_pilot_id)} en ${getAircraftName(flight.tow_aircraft_id)}`,
              is_non_billable_for_pilot: false
            });
            totalTowsCount += 1;
          }
        });

      const sortedData = billableItems.sort((a, b) => a.date.localeCompare(b.date));
      
      setReportData(sortedData);
      setTotalBillableMinutes(totalMins);
      setTotalTows(totalTowsCount);

      if (sortedData.length === 0) {
        toast({ title: "Sin Resultados", description: "No se encontraron vuelos a facturar para este piloto en el rango seleccionado." });
      }

    } catch (error: any) {
        logSupabaseError('Error generando informe de facturación', error);
        toast({ title: "Error Inesperado", description: "Ocurrió un error al generar el informe.", variant: "destructive" });
    } finally {
        setIsGenerating(false);
    }
  }, [startDate, endDate, selectedPilotId, getAircraftName, getPilotName, getPurposeName, toast, fetchCompletedEngineFlightsForRange, fetchCompletedGliderFlightsForRange]);

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
      
      const pilotNameForTitle = getPilotName(selectedPilotId) || 'Piloto no encontrado';

      const pageTitle = `Informe de Facturación para ${pilotNameForTitle} (${startDate ? format(startDate, "dd/MM/yy") : ''} - ${endDate ? format(endDate, "dd/MM/yy") : ''})`;
      let currentY = 15;

      doc.setFontSize(16);
      doc.text(pageTitle, 14, currentY);
      currentY += 10;

      const tableColumn = ["Fecha", "Tipo", "Aeronave", "Notas / Propósito", "Minutos Facturables", "Cant. Remolques"];
      const tableRows: (string | { content: string; styles?: any })[][] = [];

      reportData.forEach(item => {
        let styles: any = {};
        if (item.is_non_billable_for_pilot) {
            styles = { textColor: [150, 150, 150], fontStyle: 'italic' };
        }
        
        tableRows.push([
          { content: format(parseISO(item.date), "dd/MM/yyyy", { locale: es }), styles },
          { content: item.type, styles },
          { content: item.aircraft, styles },
          { content: item.notes, styles },
          { content: item.billable_minutes?.toString() ?? '-', styles },
          { content: item.is_non_billable_for_pilot ? '-' : (item.type.startsWith('Remolque') ? '1' : '-'), styles },
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [30, 100, 160], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 20 }, 
            1: { cellWidth: 'auto' }, 
            2: { cellWidth: 'auto' }, 
            3: { cellWidth: 100 }, 
            4: { cellWidth: 25 }, 
            5: { cellWidth: 25 }, 
        },
        didParseCell: function (data) {
          if (data.cell.raw && typeof data.cell.raw === 'object' && data.cell.raw !== null && 'styles' in data.cell.raw) {
            Object.assign(data.cell.styles, (data.cell.raw as any).styles);
            data.cell.text = (data.cell.raw as any).content;
          }
        }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY || currentY;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("TOTALES A ABONAR:", 14, finalY + 10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Minutos Vuelo Motor: ${totalBillableMinutes} min`, 14, finalY + 15);
      doc.text(`Total Remolques de Planeador: ${totalTows}`, 14, finalY + 20);
      
      const pilotFileNamePart = (getPilotName(selectedPilotId) || 'piloto').replace(/, /g, '_').replace(/ /g, '_').toLowerCase();
      const fileName = `facturacion_${pilotFileNamePart}_${startDate ? format(startDate, "yyyyMMdd") : 'inicio'}_a_${endDate ? format(endDate, "yyyyMMdd") : 'fin'}.pdf`;
      doc.save(fileName);
      toast({ title: "PDF Exportado", description: `El informe de facturación se ha guardado como ${fileName}.` });

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
        const headers = ["Fecha", "Tipo", "Aeronave", "Notas_Proposito", "Minutos_Facturables", "Cantidad_Remolques"];
        let csvContent = "ufeff" + headers.join(',') + "\n"; // Add UTF-8 BOM

        reportData.forEach(item => {
            const row = [
                format(parseISO(item.date), "dd/MM/yyyy", { locale: es }),
                `"${item.type.replace(/"/g, '""')}"`,
                `"${item.aircraft.replace(/"/g, '""')}"`,
                `"${item.notes.replace(/"/g, '""')}"`,
                item.billable_minutes ?? '',
                item.is_non_billable_for_pilot ? '' : (item.type.startsWith('Remolque') ? '1' : ''),
            ];
            csvContent += row.join(',') + "\n";
        });

        csvContent += "\n";
        csvContent += `"TOTALES A ABONAR",,,,"${totalBillableMinutes} min","${totalTows}"\n`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");

        const pilotFileNamePart = (getPilotName(selectedPilotId) || 'piloto').replace(/, /g, '_').replace(/ /g, '_').toLowerCase();
        const fileName = `facturacion_${pilotFileNamePart}_${startDate ? format(startDate, "yyyyMMdd") : 'inicio'}_a_${endDate ? format(endDate, "yyyyMMdd") : 'fin'}.csv`;
        
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
  }, [reportData, toast, getPilotName, selectedPilotId, startDate, endDate, totalBillableMinutes, totalTows]);


  const isLoadingUI = authLoading || pilotsLoading || aircraftLoading || purposesLoading;

  if (authLoading) {
    return (
        <div className="space-y-2 mt-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    )
  }

  if (!currentUser?.is_admin && !selectedPilotId) {
    return (
       <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Perfil no Vinculado</AlertTitle>
            <AlertDescription>Tu usuario no está vinculado a un perfil de piloto. Contacta a un administrador.</AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-card flex-wrap">
        <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant={"outline"} className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !startDate && "text-muted-foreground")} disabled={isLoadingUI || isGenerating}>
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
            <Button variant={"outline"} className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !endDate && "text-muted-foreground")} disabled={isLoadingUI || isGenerating}>
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
              <Button variant="outline" role="combobox" className={cn("w-full sm:w-auto md:w-[240px] justify-between", !selectedPilotId && "text-muted-foreground")} disabled={isLoadingUI || isGenerating || !currentUser?.is_admin}>
              {selectedPilotId ? getPilotName(selectedPilotId) : "Seleccionar Piloto"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                  <CommandInput placeholder="Buscar piloto..." />
                  <CommandList>
                      <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                      <CommandGroup>
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

        <Button onClick={handleGenerateReport} disabled={isGenerating || isLoadingUI || !startDate || !endDate || !selectedPilotId} className="w-full sm:w-auto">
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Generar Informe
        </Button>
         {reportData.length > 0 && !isGenerating && (
            <>
                <Button onClick={handleExportPdf} variant="outline" disabled={isGenerating || isLoadingUI} className="w-full sm:w-auto">
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Exportar a PDF
                </Button>
                <Button onClick={handleExportCsv} variant="outline" disabled={isGenerating || isLoadingUI} className="w-full sm:w-auto">
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                    Exportar a CSV
                </Button>
            </>
        )}
      </div>

      {(isLoadingUI && !isGenerating) && (
          <div className="space-y-2 mt-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full" />
          </div>
      )}
      
      {isGenerating && (
         <div className="space-y-2 mt-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isGenerating && reportData.length > 0 && (
        <div className="overflow-x-auto rounded-lg border shadow-sm mt-4">
          <Table>
            <TableCaption>Informe de facturación para {getPilotName(selectedPilotId)} del {startDate ? format(startDate, "dd/MM/yy") : ''} al {endDate ? format(endDate, "dd/MM/yy") : ''}.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Aeronave</TableHead>
                <TableHead>Notas / Propósito</TableHead>
                <TableHead className="text-right">Minutos Facturables</TableHead>
                <TableHead className="text-right">Cant. Remolques</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((item) => (
                <TableRow key={item.id} className={cn(item.is_non_billable_for_pilot && "text-muted-foreground italic")}>
                  <TableCell>{format(parseISO(item.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.aircraft}</TableCell>
                  <TableCell>{item.notes}</TableCell>
                  <TableCell className="text-right">{item.billable_minutes ?? '-'}</TableCell>
                  <TableCell className="text-right">{item.is_non_billable_for_pilot ? '-' : (item.type.startsWith('Remolque') ? '1' : '-')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
                <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="font-bold text-right">TOTALES A ABONAR</TableCell>
                    <TableCell className="text-right font-bold">{totalBillableMinutes} min</TableCell>
                    <TableCell className="text-right font-bold">{totalTows}</TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
