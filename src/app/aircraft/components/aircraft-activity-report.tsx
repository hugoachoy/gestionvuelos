
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

            const [engineFlights, gliderFlights] = await Promise.all([
                fetchCompletedEngineFlightsByAircraftForRange(startDateStr, endDateStr, selectedAircraftId),
                fetchCompletedGliderFlightsByAircraftForRange(startDateStr, endDateStr, selectedAircraftId),
            ]);

            if (engineFlights === null || gliderFlights === null) {
                toast({ title: "Error al generar informe", description: "No se pudieron obtener los datos de los vuelos.", variant: "destructive" });
                setIsGenerating(false);
                return;
            }

            const allFlights = [...engineFlights, ...gliderFlights];
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
    }, [startDate, endDate, selectedAircraftId, toast, fetchCompletedEngineFlightsByAircraftForRange, fetchCompletedGliderFlightsByAircraftForRange]);
    
    const isLoadingUI = aircraftLoading || pilotsLoading || isGenerating;
    const selectedAircraftDetails = useMemo(() => aircraftWithCalculatedData.find(a => a.id === selectedAircraftId), [selectedAircraftId, aircraftWithCalculatedData]);

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
