
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, FileSpreadsheet, FileText, Download, CalendarIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ScheduleEntry, PilotCategory, DailyObservation } from "@/types";
import { 
    usePilotsStore, 
    usePilotCategoriesStore, 
    useAircraftStore, 
    useScheduleStore, 
    useDailyObservationsStore 
} from '@/store/data-hooks';
import { FLIGHT_TYPES } from '@/types';
import { format, eachDayOfInterval, parseISO, isValid as isValidDate } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  scheduleDate: Date; // Used for initial date range
  // entries prop is removed as we will fetch data for the selected range
  // observationText prop is removed for the same reason
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const getEntryGroupDetails = (
  entry: ScheduleEntry,
  categories: PilotCategory[],
  getCategoryName: (id: string) => string,
  getAircraftName: (id?: string) => string
): { id: string; name: string } => {
  const categoryName = getCategoryName(entry.pilot_category_id);
  const instructorCategory = categories.find(c => c.name === 'Instructor');
  const remolcadorCategory = categories.find(c => c.name === 'Remolcador');

  if (entry.pilot_category_id === instructorCategory?.id) {
    return { id: 'instructor', name: 'Instructores' };
  }
  if (entry.pilot_category_id === remolcadorCategory?.id) {
    if (entry.is_tow_pilot_available) {
      return { id: 'remolcador_disponible', name: 'Pilotos Remolcadores (Disponibles)' };
    }
    return { id: 'remolcador_no_disponible', name: 'Pilotos Remolcadores (No Disponibles)' };
  }
  if (entry.aircraft_id) {
    return { id: `aircraft_${entry.aircraft_id}`, name: `Aeronave: ${getAircraftName(entry.aircraft_id)}` };
  }
  return { id: 'sin_aeronave', name: 'Vuelos sin Aeronave Asignada' };
};

export function ShareButton({ scheduleDate }: ShareButtonProps) {
  const { toast } = useToast();
  const { getPilotName } = usePilotsStore();
  const { categories, getCategoryName } = usePilotCategoriesStore();
  const { getAircraftName } = useAircraftStore();
  const { fetchScheduleEntriesForRange } = useScheduleStore();
  const { fetchObservationsForRange } = useDailyObservationsStore();

  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(scheduleDate);
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(scheduleDate);
  const [isExporting, setIsExporting] = useState(false);
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);

  const getFormattedEntry = (entry: ScheduleEntry) => {
    const pilotName = getPilotName(entry.pilot_id);
    const categoryNameForEntry = getCategoryName(entry.pilot_category_id);
    const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flight_type_id)?.name || 'N/A';
    const aircraftText = entry.aircraft_id ? getAircraftName(entry.aircraft_id) : 'N/A';
    let towPilotStatus = '';
    if (categoryNameForEntry === 'Remolcador') {
      towPilotStatus = entry.is_tow_pilot_available ? 'Sí' : 'No';
    }
    return {
      time: entry.start_time.substring(0, 5),
      pilot: pilotName,
      category: categoryNameForEntry,
      towAvailable: towPilotStatus,
      flightType: flightTypeName,
      aircraft: aircraftText,
    };
  };

  const fetchDataForRange = useCallback(async () => {
    if (!exportStartDate || !exportEndDate) {
      toast({ title: "Error", description: "Por favor, seleccione un rango de fechas válido.", variant: "destructive" });
      return null;
    }
    if (exportEndDate < exportStartDate) {
        toast({ title: "Error", description: "La fecha de fin no puede ser anterior a la fecha de inicio.", variant: "destructive" });
        return null;
    }

    setIsExporting(true);
    try {
      const startDateStr = format(exportStartDate, "yyyy-MM-dd");
      const endDateStr = format(exportEndDate, "yyyy-MM-dd");

      const [entries, observations] = await Promise.all([
        fetchScheduleEntriesForRange(startDateStr, endDateStr),
        fetchObservationsForRange(startDateStr, endDateStr)
      ]);

      if (entries === null || observations === null) {
        toast({ title: "Error al obtener datos", description: "No se pudieron cargar los datos para el rango seleccionado.", variant: "destructive" });
        return null;
      }
      return { entries, observations };
    } catch (error) {
      console.error("Error fetching data for export:", error);
      toast({ title: "Error", description: "Ocurrió un error al obtener los datos para exportar.", variant: "destructive" });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [exportStartDate, exportEndDate, fetchScheduleEntriesForRange, fetchObservationsForRange, toast]);


  const generateShareTextForRange = (allEntries: ScheduleEntry[], allObservations: DailyObservation[]) => {
    if (!exportStartDate || !exportEndDate) return "Rango de fechas no seleccionado.";

    let fullText = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })} - ${format(exportEndDate, "PPP", { locale: es })}\n`;
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });

    dateInterval.forEach(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      fullText += `\n=== ${format(day, "PPP", { locale: es })} ===\n`;

      const observationForDay = allObservations.find(obs => obs.date === dayStr);
      if (observationForDay && observationForDay.observation_text) {
        fullText += `\nObservaciones:\n${observationForDay.observation_text}\n`;
      }

      const entriesForDay = allEntries.filter(entry => entry.date === dayStr);
      if (entriesForDay.length === 0) {
        fullText += "No hay turnos programados para esta fecha.\n";
      } else {
        let previousGroupIdentifier: string | null = null;
        // Entries are already sorted by the fetch function (date then time)
        // We need to sort them again here based on the complex grouping logic
        const sortedEntriesForDay = [...entriesForDay].sort((a, b) => {
            const groupA = getEntryGroupDetails(a, categories, getCategoryName, getAircraftName);
            const groupB = getEntryGroupDetails(b, categories, getCategoryName, getAircraftName);

            // Define the order of main groups
            const groupOrder = (groupId: string) => {
                if (groupId === 'instructor') return 1;
                if (groupId === 'remolcador_disponible') return 2;
                if (groupId === 'remolcador_no_disponible') return 3;
                if (groupId.startsWith('aircraft_')) return 4;
                return 5; // sin_aeronave
            };

            const orderA = groupOrder(groupA.id);
            const orderB = groupOrder(groupB.id);

            if (orderA !== orderB) return orderA - orderB;
            
            // If in the same main group, sort by specific criteria
            if (groupA.id.startsWith('aircraft_') && groupB.id.startsWith('aircraft_')) {
                 if (groupA.id !== groupB.id) return groupA.id.localeCompare(groupB.id);
            }

            // Sort by start_time
            const timeComparison = a.start_time.localeCompare(b.start_time);
            if (timeComparison !== 0) return timeComparison;

            // Sort by sport preference (Deportivo first)
            const aIsSport = a.flight_type_id === 'sport';
            const bIsSport = b.flight_type_id === 'sport';
            if (aIsSport && !bIsSport) return -1;
            if (!aIsSport && bIsSport) return 1;
            
            return 0;
        });


        sortedEntriesForDay.forEach(entry => {
          const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
          if (groupDetails.id !== previousGroupIdentifier) {
            fullText += `\n--- ${groupDetails.name} ---\n`;
            previousGroupIdentifier = groupDetails.id;
          }
          const formatted = getFormattedEntry(entry);
          fullText += `${formatted.time} - ${formatted.pilot} (${formatted.category}${formatted.towAvailable ? ' - Rem: ' + formatted.towAvailable : ''}) - ${formatted.flightType}${formatted.aircraft !== 'N/A' ? ' - Aeronave: ' + formatted.aircraft : ''}\n`;
        });
      }
    });
    return fullText;
  };

  const handleShareText = async () => {
    const data = await fetchDataForRange();
    if (!data) return;

    const shareText = generateShareTextForRange(data.entries, data.observations);
    const shareData = {
      title: `Agenda de Vuelo: ${exportStartDate ? format(exportStartDate, "PPP", { locale: es }) : ''} - ${exportEndDate ? format(exportEndDate, "PPP", { locale: es }) : ''}`,
      text: shareText,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Agenda compartida", description: "La agenda se ha compartido exitosamente." });
      } catch (err) {
        console.error("Error al compartir:", err);
        try {
          await navigator.clipboard.writeText(shareText);
          toast({ title: "Enlace copiado", description: "No se pudo compartir, la agenda se copió al portapapeles." });
        } catch (copyError) {
          toast({ title: "Error al compartir", description: "No se pudo compartir ni copiar la agenda.", variant: "destructive" });
        }
      }
    } else {
       try {
        await navigator.clipboard.writeText(shareText);
        toast({ title: "Agenda copiada", description: "Tu navegador no soporta compartir directamente. La agenda se copió al portapapeles." });
      } catch (err) {
        toast({ title: "Error", description: "Tu navegador no soporta la función de compartir ni de copiar al portapapeles.", variant: "destructive" });
      }
    }
  };
  
  // Placeholder for CSV and PDF, adapt them similarly to handle ranges
  const handleExportCsv = async () => {
    const data = await fetchDataForRange();
    if (!data || !exportStartDate || !exportEndDate) return;

    let csvContent = `Agenda de Vuelo del ${format(exportStartDate, "yyyy-MM-dd", { locale: es })} al ${format(exportEndDate, "yyyy-MM-dd", { locale: es })}\n\n`;
    const headers = ["Fecha", "Hora", "Piloto", "Categoría", "Remolcador Disponible", "Tipo de Vuelo", "Aeronave", "Observaciones del Día"];
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });

    dateInterval.forEach(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const formattedDay = format(day, "dd/MM/yyyy", { locale: es });
        
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const obsText = observationForDay?.observation_text ? `"${observationForDay.observation_text.replace(/"/g, '""')}"` : "";

        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);
        
        if (entriesForDay.length === 0 && !observationForDay?.observation_text) {
            // Optionally skip days with no entries and no observations, or list them as empty
            // csvContent += `"${formattedDay}",No hay turnos ni observaciones,,,,,\n`;
            return; 
        }
        
        if (entriesForDay.length === 0 && observationForDay?.observation_text) {
            csvContent += `"${formattedDay}",,,,,,,${obsText}\n`; // Date and observation only
        }


        let previousGroupIdentifier: string | null = null;
        const sortedEntriesForDay = [...entriesForDay].sort((a, b) => { /* ... same sorting as text ... */
            const groupA = getEntryGroupDetails(a, categories, getCategoryName, getAircraftName);
            const groupB = getEntryGroupDetails(b, categories, getCategoryName, getAircraftName);
            const groupOrder = (groupId: string) => {
                if (groupId === 'instructor') return 1;
                if (groupId === 'remolcador_disponible') return 2;
                if (groupId === 'remolcador_no_disponible') return 3;
                if (groupId.startsWith('aircraft_')) return 4;
                return 5; 
            };
            const orderA = groupOrder(groupA.id);
            const orderB = groupOrder(groupB.id);
            if (orderA !== orderB) return orderA - orderB;
            if (groupA.id.startsWith('aircraft_') && groupB.id.startsWith('aircraft_')) {
                 if (groupA.id !== groupB.id) return groupA.id.localeCompare(groupB.id);
            }
            const timeComparison = a.start_time.localeCompare(b.start_time);
            if (timeComparison !== 0) return timeComparison;
            const aIsSport = a.flight_type_id === 'sport';
            const bIsSport = b.flight_type_id === 'sport';
            if (aIsSport && !bIsSport) return -1;
            if (!aIsSport && bIsSport) return 1;
            return 0;
        });

        if (entriesForDay.length > 0 || (observationForDay && observationForDay.observation_text)) {
             csvContent += `\n"${formattedDay}",,,,,,,${entriesForDay.length > 0 ? "" : obsText}\n`; // Header for the day with date
             csvContent += headers.join(",") + "\n"; // Column headers for each day block
        }


        sortedEntriesForDay.forEach((entry, index) => {
          const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
          if (groupDetails.id !== previousGroupIdentifier) {
            csvContent += `"${groupDetails.name}",,,,,,\n`; 
            previousGroupIdentifier = groupDetails.id;
          }
          const formatted = getFormattedEntry(entry);
          const row = [
            index === 0 && entriesForDay.length > 0 ? "" : "", // Date only on first row for day or if only obs
            formatted.time,
            `"${formatted.pilot.replace(/"/g, '""')}"`,
            `"${formatted.category.replace(/"/g, '""')}"`,
            formatted.towAvailable,
            `"${formatted.flightType.replace(/"/g, '""')}"`,
            `"${formatted.aircraft.replace(/"/g, '""')}"`,
            index === 0 && entriesForDay.length > 0 ? obsText : "" // Observation on first entry row
          ];
          csvContent += row.join(",") + "\n";
        });
         csvContent += "\n"; // Extra line break between days
    });


    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `agenda_rango_${format(exportStartDate, "yyyy-MM-dd")}_a_${format(exportEndDate, "yyyy-MM-dd")}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "CSV Exportado", description: "La agenda del rango seleccionado se ha exportado a CSV." });
    } else {
      toast({ title: "Error de Exportación", description: "Tu navegador no soporta la descarga de archivos.", variant: "destructive"});
    }
  };

  const handleExportPdf = async () => {
    const data = await fetchDataForRange();
    if (!data || !exportStartDate || !exportEndDate) return;
    
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageTitle = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })} - ${format(exportEndDate, "PPP", { locale: es })}`;
    let currentY = 15;

    doc.setFontSize(16);
    doc.text(pageTitle, 14, currentY);
    currentY += 10;

    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });

    dateInterval.forEach((day, dayIndex) => {
        if (dayIndex > 0) { // Add page break for subsequent days
            doc.addPage();
            currentY = 15;
        }

        const dayStr = format(day, "yyyy-MM-dd");
        doc.setFontSize(14);
        doc.text(`Fecha: ${format(day, "PPP", { locale: es })}`, 14, currentY);
        currentY += 7;

        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        if (observationForDay && observationForDay.observation_text) {
            doc.setFontSize(10);
            const observationLines = doc.splitTextToSize(observationForDay.observation_text, doc.internal.pageSize.getWidth() - 28);
            doc.text("Observaciones:", 14, currentY);
            currentY += 5;
            observationLines.forEach((line: string) => {
                if (currentY > doc.internal.pageSize.getHeight() - 20) { // Check for page overflow
                    doc.addPage();
                    currentY = 15;
                }
                doc.text(line, 14, currentY);
                currentY += 5;
            });
            currentY += 5; // Extra space after observations
        }

        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);
        if (entriesForDay.length === 0) {
            doc.setFontSize(10);
            doc.text("No hay turnos programados para esta fecha.", 14, currentY);
            currentY += 10;
        } else {
            const tableColumn = ["Hora", "Piloto", "Categoría", "Rem. Disp.", "Tipo Vuelo", "Aeronave"];
            const tableRows: (string | { content: string; colSpan: number; styles: any } | null)[][] = [];
            
            let previousGroupIdentifier: string | null = null;
            const sortedEntriesForDay = [...entriesForDay].sort((a, b) => { /* ... same sorting as text ... */
                const groupA = getEntryGroupDetails(a, categories, getCategoryName, getAircraftName);
                const groupB = getEntryGroupDetails(b, categories, getCategoryName, getAircraftName);
                const groupOrder = (groupId: string) => {
                    if (groupId === 'instructor') return 1;
                    if (groupId === 'remolcador_disponible') return 2;
                    if (groupId === 'remolcador_no_disponible') return 3;
                    if (groupId.startsWith('aircraft_')) return 4;
                    return 5; 
                };
                const orderA = groupOrder(groupA.id);
                const orderB = groupOrder(groupB.id);
                if (orderA !== orderB) return orderA - orderB;
                if (groupA.id.startsWith('aircraft_') && groupB.id.startsWith('aircraft_')) {
                    if (groupA.id !== groupB.id) return groupA.id.localeCompare(groupB.id);
                }
                const timeComparison = a.start_time.localeCompare(b.start_time);
                if (timeComparison !== 0) return timeComparison;
                const aIsSport = a.flight_type_id === 'sport';
                const bIsSport = b.flight_type_id === 'sport';
                if (aIsSport && !bIsSport) return -1;
                if (!aIsSport && bIsSport) return 1;
                return 0;
            });

            sortedEntriesForDay.forEach(entry => {
                const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
                if (groupDetails.id !== previousGroupIdentifier) {
                    tableRows.push([
                        {
                        content: groupDetails.name,
                        colSpan: tableColumn.length,
                        styles: { fontStyle: 'bold', fillColor: [214, 234, 248], textColor: [21, 67, 96], halign: 'left' },
                        },
                    ]);
                    previousGroupIdentifier = groupDetails.id;
                }
                const formatted = getFormattedEntry(entry);
                tableRows.push([
                    formatted.time,
                    formatted.pilot,
                    formatted.category,
                    formatted.towAvailable || '-',
                    formatted.flightType,
                    formatted.aircraft,
                ]);
            });
            
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                styles: { fontSize: 8, cellPadding: 1.5 },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 25 },
                    4: { cellWidth: 30 },
                    5: { cellWidth: 'auto' },
                },
                didDrawPage: (data) => { // Update currentY after a page is drawn (if autotable adds pages)
                    currentY = data.cursor?.y ?? currentY;
                },
                didParseCell: function (data) {
                    if (data.row.raw && typeof data.row.raw[0] === 'object' && (data.row.raw[0] as any).colSpan) {
                        data.cell.styles.fontStyle = (data.row.raw[0] as any).styles.fontStyle || 'normal';
                        data.cell.styles.fillColor = (data.row.raw[0] as any).styles.fillColor;
                        data.cell.styles.textColor = (data.row.raw[0] as any).styles.textColor;
                        if (data.cell.raw && typeof data.cell.raw === 'object' && (data.cell.raw as any).colSpan) {
                            data.cell.colSpan = (data.cell.raw as any).colSpan;
                        }
                    }
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10; // Get Y position after table
        }
    });


    doc.save(`agenda_rango_${format(exportStartDate, "yyyy-MM-dd")}_a_${format(exportEndDate, "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF Exportado", description: "La agenda del rango seleccionado se ha exportado a PDF." });
  };


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Compartir/Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72"> {/* Increased width for date pickers */}
        <DropdownMenuLabel>Seleccionar Rango de Fechas</DropdownMenuLabel>
        <div className="p-2 space-y-2">
            <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
                <PopoverTrigger asChild>
                    <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !exportStartDate && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportStartDate ? format(exportStartDate, "PPP", {locale: es}) : <span>Fecha de Inicio</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                    mode="single"
                    selected={exportStartDate}
                    onSelect={(date) => { setExportStartDate(date); setIsStartDatePickerOpen(false);}}
                    initialFocus
                    locale={es}
                    />
                </PopoverContent>
            </Popover>
            <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                <PopoverTrigger asChild>
                    <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !exportEndDate && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportEndDate ? format(exportEndDate, "PPP", {locale: es}) : <span>Fecha de Fin</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                    mode="single"
                    selected={exportEndDate}
                    onSelect={(date) => { setExportEndDate(date); setIsEndDatePickerOpen(false); }}
                    initialFocus
                    locale={es}
                    disabled={(date) => exportStartDate && date < exportStartDate}
                    />
                </PopoverContent>
            </Popover>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShareText} disabled={isExporting || !exportStartDate || !exportEndDate}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>Compartir texto</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCsv} disabled={isExporting || !exportStartDate || !exportEndDate}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Exportar a CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPdf} disabled={isExporting || !exportStartDate || !exportEndDate}>
          <FileText className="mr-2 h-4 w-4" />
          <span>Exportar a PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
