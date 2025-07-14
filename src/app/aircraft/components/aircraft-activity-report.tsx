
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CompletedFlight, CompletedEngineFlight, CompletedGliderFlight, Aircraft } from '@/types';
import { useAircraftStore, usePilotsStore, useCompletedEngineFlightsStore, useCompletedGliderFlightsStore } from '@/store/data-hooks';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, FileText, Loader2, Check, ChevronsUpDown, Download, FileSpreadsheet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FLIGHT_PURPOSE_DISPLAY_MAP } from '@/types';

type ReportItem = CompletedFlight;

export function AircraftActivityReport() {
    const { toast } = useToast();
    const { aircraftWithCalculatedData, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
    const { getPilotName, loading: pilotsLoading, fetchPilots } = usePilotsStore();
    const { fetchCompletedEngineFlightsByAircraftForRange } = useCompletedEngineFlightsStore();
    const { fetchCompletedGliderFlightsByAircraftForRange } = useCompletedGliderFlightsStore();

    const [startDate, setStartDate] = useState<Date | undefined>(new Date());
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    const [selectedAircraftId, setSelectedAircraftId] = useState<string>('');
    
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
    const [isAircraftPickerOpen, setIsAircraftPickerOpen] = useState(false);
    
    const [reportData, setReportData] = useState<ReportItem[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [totalHours, setTotalHours] = useState(0);

    useEffect(() => {
        fetchAircraft();
        fetchPilots();
    }, [fetchAircraft, fetchPilots]);

    const handleGenerateReport = useCallback(async () => {
        if (!startDate || !endDate || !selectedAircraftId) {
            toast({ title: "Faltan datos", description: "Por favor, seleccione una aeronave y un rango de fechas.", variant: "destructive" });
            return;
        }
        if (endDate < startDate) {
            toast({ title: "Rango Inválido", description: "La fecha de fin no puede ser anterior a la fecha de inicio.", variant: "destructive" });
            return;
        }
        
        setIsGenerating(true);
        setReportData([]);
        setTotalHours(0);
        
        try {
            const startDateStr = format(startDate, "yyyy-MM-dd");
            const endDateStr = format(endDate, "yyyy-MM-dd");

            const selectedAC = aircraftWithCalculatedData.find(ac => ac.id === selectedAircraftId);
            if (!selectedAC) {
                toast({ title: "Error", description: "Aeronave no encontrada.", variant: "destructive"});
                setIsGenerating(false);
                return;
            }

            let allFlights: CompletedFlight[] = [];

            if (selectedAC.type === 'Glider') {
                const gliderFlights = await fetchCompletedGliderFlightsByAircraftForRange(startDateStr, endDateStr, selectedAircraftId);
                if(gliderFlights) allFlights = [...gliderFlights];
            } else {
                 const engineFlights = await fetchCompletedEngineFlightsByAircraftForRange(startDateStr, endDateStr, selectedAircraftId);
                 if(engineFlights) allFlights = [...engineFlights];
            }


            if (allFlights === null) {
                toast({ title: "Error al generar informe", description: "No se pudieron obtener los datos de los vuelos.", variant: "destructive" });
                setIsGenerating(false);
                return;
            }

            const sortedData = allFlights.sort((a, b) => a.date.localeCompare(b.date) || a.departure_time.localeCompare(b.departure_time));
            const total = sortedData.reduce((acc, flight) => acc + flight.flight_duration_decimal, 0);

            setReportData(sortedData);
            setTotalHours(total);

            if (sortedData.length === 0) {
                toast({ title: "Sin Resultados", description: "No se encontraron vuelos para esta aeronave en el rango seleccionado." });
            }

        } catch (error: any) {
            console.error('Error generando informe de actividad de aeronave', error);
            toast({ title: "Error Inesperado", description: "Ocurrió un error al generar el informe.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    }, [startDate, endDate, selectedAircraftId, toast, fetchCompletedEngineFlightsByAircraftForRange, fetchCompletedGliderFlightsByAircraftForRange, aircraftWithCalculatedData]);
    
    const isLoadingUI = aircraftLoading || pilotsLoading || isGenerating;
    const selectedAircraftDetails = useMemo(() => aircraftWithCalculatedData.find(a => a.id === selectedAircraftId), [selectedAircraftId, aircraftWithCalculatedData]);

    const handleExportPdf = async () => {
      if (reportData.length === 0 || !selectedAircraftDetails) {
        toast({ title: "Sin Datos", description: "No hay datos para exportar.", variant: "default" });
        return;
      }
      setIsGenerating(true);
      try {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF({ orientation: 'landscape' });
        
        const pageTitle = `Informe de Actividad para ${selectedAircraftDetails.name} (${startDate ? format(startDate, "dd/MM/yy") : ''} - ${endDate ? format(endDate, "dd/MM/yy") : ''})`;
        let currentY = 15;

        doc.setFontSize(16);
        doc.text(pageTitle, 14, currentY);
        currentY += 10;

        let tableColumn = ["Fecha", "Piloto", "Instructor", "Propósito", "Duración", "Notas"];
        let tableRows: (string | null)[][] = [];
        let columnStyles: any = { 0: { cellWidth: 18 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 30 }, 4: { cellWidth: 15 }, 5: { cellWidth: 70 } };
        
        const isEngine = selectedAircraftDetails.type !== 'Glider';
        if (isEngine) {
            tableColumn = ["Fecha", "Piloto", "Instructor", "Propósito", "Duración", "Aterrizajes", "Aceite (L)", "Nafta (L)", "Notas"];
            columnStyles = { 0: { cellWidth: 18 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 30 }, 4: { cellWidth: 15 }, 5: { cellWidth: 18 }, 6: { cellWidth: 18 }, 7: { cellWidth: 18 }, 8: { cellWidth: 50 }};
        }


        reportData.forEach(item => {
            const rowBase = [
                format(parseISO(item.date), "dd/MM/yyyy", { locale: es }),
                getPilotName(item.pilot_id),
                item.instructor_id ? getPilotName(item.instructor_id) : '-',
                FLIGHT_PURPOSE_DISPLAY_MAP[item.flight_purpose as keyof typeof FLIGHT_PURPOSE_DISPLAY_MAP] || item.flight_purpose,
                `${item.flight_duration_decimal.toFixed(1)} hs`,
            ];

            if (isEngine) {
                const engineItem = item as CompletedEngineFlight;
                tableRows.push([
                    ...rowBase,
                    engineItem.landings_count?.toString() ?? '-',
                    engineItem.oil_added_liters?.toString() ?? '-',
                    engineItem.fuel_added_liters?.toString() ?? '-',
                    item.notes || '-',
                ]);
            } else {
                tableRows.push([...rowBase, item.notes || '-']);
            }
        });

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          foot: [[
            { content: 'TOTAL HORAS', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: `${totalHours.toFixed(1)} hs`, styles: { fontStyle: 'bold' } },
            { content: '', colSpan: isEngine ? 4 : 1 },
          ]],
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [30, 100, 160], textColor: 255 },
          styles: { fontSize: 8, cellPadding: 1.5 },
          columnStyles: columnStyles,
        });
        
        const aircraftFileNamePart = (selectedAircraftDetails.name).replace(/ /g, '_').toLowerCase();
        const fileName = `actividad_${aircraftFileNamePart}_${startDate ? format(startDate, "yyyyMMdd") : 'inicio'}_a_${endDate ? format(endDate, "yyyyMMdd") : 'fin'}.pdf`;
        doc.save(fileName);
        toast({ title: "PDF Exportado", description: `El informe de actividad se ha guardado como ${fileName}.` });

      } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: "Error de Exportación", description: "No se pudo generar el PDF.", variant: "destructive" });
      } finally {
        setIsGenerating(false);
      }
    };


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

                <Popover open={isAircraftPickerOpen} onOpenChange={setIsAircraftPickerOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className={cn("w-full sm:w-auto md:w-[240px] justify-between", !selectedAircraftId && "text-muted-foreground")} disabled={isLoadingUI}>
                            {selectedAircraftDetails ? selectedAircraftDetails.name : "Seleccionar Aeronave"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Buscar aeronave..." />
                            <CommandList>
                                <CommandEmpty>No se encontraron aeronaves.</CommandEmpty>
                                <CommandGroup>
                                    {aircraftWithCalculatedData.map(ac => (
                                        <CommandItem key={ac.id} value={ac.name} onSelect={() => { setSelectedAircraftId(ac.id); setIsAircraftPickerOpen(false); }}>
                                            <Check className={cn("mr-2 h-4 w-4", selectedAircraftId === ac.id ? "opacity-100" : "opacity-0")} />
                                            {ac.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Button onClick={handleGenerateReport} disabled={isLoadingUI || !startDate || !endDate || !selectedAircraftId} className="w-full sm:w-auto">
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Generar Informe
                </Button>
                {reportData.length > 0 && !isGenerating && (
                    <Button onClick={handleExportPdf} variant="outline" disabled={isGenerating || isLoadingUI} className="w-full sm:w-auto">
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Exportar a PDF
                    </Button>
                )}
            </div>

            {isGenerating && (
                <div className="space-y-2 mt-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            )}

            {!isGenerating && reportData.length > 0 && selectedAircraftDetails && (
                <div className="overflow-x-auto rounded-lg border shadow-sm mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Piloto</TableHead>
                                <TableHead>Instructor</TableHead>
                                <TableHead>Propósito</TableHead>
                                <TableHead>Duración</TableHead>
                                {selectedAircraftDetails.type !== 'Glider' && <TableHead>Aterrizajes</TableHead>}
                                {selectedAircraftDetails.type !== 'Glider' && <TableHead>Aceite (Lts)</TableHead>}
                                {selectedAircraftDetails.type !== 'Glider' && <TableHead>Nafta (Lts)</TableHead>}
                                <TableHead>Notas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{format(parseISO(item.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                                    <TableCell>{getPilotName(item.pilot_id)}</TableCell>
                                    <TableCell>{item.instructor_id ? getPilotName(item.instructor_id) : '-'}</TableCell>
                                    <TableCell>{FLIGHT_PURPOSE_DISPLAY_MAP[item.flight_purpose as keyof typeof FLIGHT_PURPOSE_DISPLAY_MAP] || item.flight_purpose}</TableCell>
                                    <TableCell>{item.flight_duration_decimal.toFixed(1)} hs</TableCell>
                                    {selectedAircraftDetails.type !== 'Glider' && <TableCell>{(item as CompletedEngineFlight).landings_count ?? '-'}</TableCell>}
                                    {selectedAircraftDetails.type !== 'Glider' && <TableCell>{(item as CompletedEngineFlight).oil_added_liters ?? '-'}</TableCell>}
                                    {selectedAircraftDetails.type !== 'Glider' && <TableCell>{(item as CompletedEngineFlight).fuel_added_liters ?? '-'}</TableCell>}
                                    <TableCell>{item.notes || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={4} className="text-right">TOTAL HORAS</TableCell>
                                <TableCell>{totalHours.toFixed(1)} hs</TableCell>
                                <TableCell colSpan={selectedAircraftDetails.type !== 'Glider' ? 4 : 1}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            )}
        </div>
    );
}

