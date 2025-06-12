
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useCompletedGliderFlightsStore, usePilotsStore, useAircraftStore, usePilotCategoriesStore } from '@/store/data-hooks';
import type { CompletedGliderFlight } from '@/types';
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
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Download, FileText, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export function GliderFlightReportClient() {
  const { fetchCompletedGliderFlightsForRange, loading: flightsLoading, error: flightsError } = useCompletedGliderFlightsStore();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { getAircraftName, aircraft, loading: aircraftLoading, fetchAircraft } = useAircraftStore();
  const { getCategoryName, categories, loading: categoriesLoading, fetchCategories } = usePilotCategoriesStore(); // Added categories store
  const { toast } = useToast();

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [reportData, setReportData] = useState<CompletedGliderFlight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchPilots();
    fetchAircraft();
    fetchCategories();
  }, [fetchPilots, fetchAircraft, fetchCategories]);

  const handleGenerateReport = useCallback(async () => {
    if (!startDate || !endDate) {
      toast({ title: "Fechas Requeridas", description: "Por favor, seleccione un rango de fechas.", variant: "destructive" });
      return;
    }
    if (endDate < startDate) {
        toast({ title: "Rango Inválido", description: "La fecha de fin no puede ser anterior a la fecha de inicio.", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setReportData([]);
    const data = await fetchCompletedGliderFlightsForRange(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"));
    if (data) {
      setReportData(data);
      if (data.length === 0) {
        toast({ title: "Sin Resultados", description: "No se encontraron vuelos de planeador para el rango seleccionado." });
      }
    } else {
      toast({ title: "Error al Generar", description: "No se pudo obtener el informe.", variant: "destructive" });
    }
    setIsGenerating(false);
  }, [startDate, endDate, fetchCompletedGliderFlightsForRange, toast]);
  
  const handleExportPdf = () => {
    if (reportData.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos para exportar.", variant: "default" });
      return;
    }
    setIsGenerating(true); // Reuse for PDF generation loading state
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageTitle = `Informe de Vuelos en Planeador (${startDate ? format(startDate, "dd/MM/yy") : ''} - ${endDate ? format(endDate, "dd/MM/yy") : ''})`;
      let currentY = 15;

      doc.setFontSize(16);
      doc.text(pageTitle, 14, currentY);
      currentY += 10;

      const tableColumn = ["Fecha", "Piloto (PIC)", "Planeador", "Instructor", "Piloto Rem.", "Avión Rem.", "Salida", "Llegada", "Duración", "Propósito"];
      const tableRows: (string | null)[][] = [];

      reportData.forEach(flight => {
        tableRows.push([
          format(parseISO(flight.date), "dd/MM/yyyy", { locale: es }),
          getPilotName(flight.pilot_id),
          getAircraftName(flight.glider_aircraft_id),
          flight.instructor_id ? getPilotName(flight.instructor_id) : '-',
          flight.tow_pilot_id ? getPilotName(flight.tow_pilot_id) : '-',
          flight.tow_aircraft_id ? getAircraftName(flight.tow_aircraft_id) : '-',
          flight.departure_time,
          flight.arrival_time,
          `${flight.flight_duration_decimal.toFixed(1)} hs`,
          flight.flight_purpose,
        ]);
      });

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [30, 100, 160], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 20 }, // Fecha
            1: { cellWidth: 'auto' }, // Piloto
            2: { cellWidth: 'auto' }, // Planeador
            3: { cellWidth: 'auto' }, // Instructor
            4: { cellWidth: 'auto' }, // Piloto Rem.
            5: { cellWidth: 'auto' }, // Avión Rem.
            6: { cellWidth: 15 }, // Salida
            7: { cellWidth: 15 }, // Llegada
            8: { cellWidth: 18 }, // Duración
            9: { cellWidth: 25 }, // Propósito
        },
      });
      
      const fileName = `informe_vuelos_planeador_${startDate ? format(startDate, "yyyyMMdd") : 'inicio'}_a_${endDate ? format(endDate, "yyyyMMdd") : 'fin'}.pdf`;
      doc.save(fileName);
      toast({ title: "PDF Exportado", description: `El informe se ha guardado como ${fileName}.` });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error de Exportación", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };


  const isLoadingUI = flightsLoading || pilotsLoading || aircraftLoading || categoriesLoading || isGenerating;

  if (flightsError) {
    return <div className="text-destructive">Error al cargar datos para el informe: {flightsError.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-card">
        <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}
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
              className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}
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

        <Button onClick={handleGenerateReport} disabled={isLoadingUI || !startDate || !endDate} className="w-full sm:w-auto">
          {isLoadingUI && isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Generar Informe
        </Button>
         {reportData.length > 0 && (
            <Button onClick={handleExportPdf} variant="outline" disabled={isLoadingUI} className="w-full sm:w-auto">
                {isLoadingUI && isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Exportar a PDF
            </Button>
        )}
      </div>

      {isLoadingUI && !reportData.length && (
         <div className="space-y-2 mt-4">
          <Skeleton className="h-12 w-full" /> {/* Header row */}
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
                <TableHead>Piloto (PIC)</TableHead>
                <TableHead>Planeador</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Piloto Rem.</TableHead>
                <TableHead>Avión Rem.</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Llegada</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Propósito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((flight) => (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!isLoadingUI && !isGenerating && reportData.length === 0 && startDate && endDate && (
        <div className="text-center text-muted-foreground mt-4 p-4 border rounded-lg">
          No se encontraron vuelos de planeador para el rango de fechas seleccionado.
        </div>
      )}
    </div>
  );
}
