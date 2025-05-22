
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
  scheduleDate: Date;
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// This helper function determines the main sorting/grouping category for an entry
const getEntryGroupDetails = (
  entry: ScheduleEntry,
  categories: PilotCategory[],
  getCategoryName: (id: string) => string,
  getAircraftName: (id?: string) => string
): { id: string; name: string } => {
  // const pilotCategoryNameForTurn = getCategoryName(entry.pilot_category_id); // Category name for this specific turn
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
  // For other pilots, group by aircraft
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
    const pilotCategoryNameForTurn = getCategoryName(entry.pilot_category_id); // Category for the turn
    const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flight_type_id)?.name || 'N/A';
    const aircraftText = entry.aircraft_id ? getAircraftName(entry.aircraft_id) : 'N/A';
    
    let towPilotStatus = '';
    const remolcadorCategoryFromList = categories.find(c => c.name === 'Remolcador');
    if (entry.pilot_category_id === remolcadorCategoryFromList?.id) {
      towPilotStatus = entry.is_tow_pilot_available ? 'Sí' : 'No';
    }

    const instructorCategoryFromList = categories.find(c => c.name === 'Instructor');
    const isInstructionByInstructor = entry.flight_type_id === 'instruction' && entry.pilot_category_id === instructorCategoryFromList?.id;
    const isTurnByRemolcador = entry.pilot_category_id === remolcadorCategoryFromList?.id;

    const shouldFlightTypeBeBold = isInstructionByInstructor || isTurnByRemolcador;

    return {
      time: entry.start_time.substring(0, 5),
      pilot: pilotName,
      category: pilotCategoryNameForTurn,
      towAvailable: towPilotStatus,
      flightType: flightTypeName,
      aircraft: aircraftText,
      shouldFlightTypeBeBold,
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

    let fullText = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })}${exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}\n`;
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    let contentAddedForPreviousDay = false;

    dateInterval.forEach((day, index) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const observationForDay = allObservations.find(obs => obs.date === dayStr);
      const entriesForDay = allEntries.filter(entry => entry.date === dayStr);

      const hasObservationText = observationForDay && observationForDay.observation_text && observationForDay.observation_text.trim() !== '';
      if (entriesForDay.length === 0 && !hasObservationText) {
        return; 
      }
      
      if (contentAddedForPreviousDay) { 
         fullText += `\n`; 
      }
      fullText += `\n=== ${format(day, "PPP", { locale: es })} ===\n`;
      contentAddedForPreviousDay = true;


      if (hasObservationText) {
        fullText += `\nObservaciones:\n${observationForDay!.observation_text!.trim()}\n`;
      }

      if (entriesForDay.length === 0) {
          fullText += "No hay turnos programados para esta fecha.\n";
      } else {
        let previousGroupIdentifier: string | null = null;
        
        // The entries are already sorted by ScheduleClient, so we just need to iterate and insert group headers.
        entriesForDay.forEach(entry => {
          const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
          if (groupDetails.id !== previousGroupIdentifier) {
            fullText += `\n--- ${groupDetails.name} ---\n`;
            previousGroupIdentifier = groupDetails.id;
          }
          const formatted = getFormattedEntry(entry);
          let flightTypeString = formatted.flightType;
          if (formatted.shouldFlightTypeBeBold) {
            flightTypeString = `*${formatted.flightType}*`; 
          }
          fullText += `${formatted.time} - ${formatted.pilot} (${formatted.category}${formatted.towAvailable ? ' - Rem: ' + formatted.towAvailable : ''}) - ${flightTypeString}${formatted.aircraft !== 'N/A' ? ' - Aeronave: ' + formatted.aircraft : ''}\n`;
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
      title: `Agenda de Vuelo: ${exportStartDate ? format(exportStartDate, "PPP", { locale: es }) : ''}${exportStartDate && exportEndDate && exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}`,
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
  
  const handleExportCsv = async () => {
    const data = await fetchDataForRange();
    if (!data || !exportStartDate || !exportEndDate) return;

    let csvContent = `Agenda de Vuelo del ${format(exportStartDate, "yyyy-MM-dd", { locale: es })}${exportStartDate.getTime() !== exportEndDate.getTime() ? ' al ' + format(exportEndDate, "yyyy-MM-dd", { locale: es }) : ''}\n`;
    const headers = ["Hora", "Piloto", "Categoría", "Remolcador Disponible", "Tipo de Vuelo", "Aeronave"];
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    let contentAddedForPreviousDay = false;

    dateInterval.forEach((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const formattedDay = format(day, "dd/MM/yyyy", { locale: es });
        
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const hasObservationText = observationForDay?.observation_text && observationForDay.observation_text.trim() !== '';
        const obsText = hasObservationText ? `"${observationForDay!.observation_text!.trim().replace(/"/g, '""')}"` : "";
        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);
        
        if (entriesForDay.length === 0 && !hasObservationText) {
            return; 
        }

        if (contentAddedForPreviousDay) { 
          csvContent += `\n`; 
        }
        csvContent += `"${formattedDay}"\n`; 
        contentAddedForPreviousDay = true;

        if (hasObservationText) {
            csvContent += `"Observaciones:",${obsText}\n`; 
        }

        if (entriesForDay.length > 0) {
            csvContent += headers.join(",") + "\n";

            let previousGroupIdentifier: string | null = null;
            
            entriesForDay.forEach((entry) => {
              const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
              if (groupDetails.id !== previousGroupIdentifier) {
                csvContent += `"${groupDetails.name}"\n`; 
                previousGroupIdentifier = groupDetails.id;
              }
              const formatted = getFormattedEntry(entry);
              // CSV doesn't support bold, so we use the raw flightType
              const row = [
                formatted.time,
                `"${formatted.pilot.replace(/"/g, '""')}"`,
                `"${formatted.category.replace(/"/g, '""')}"`,
                formatted.towAvailable,
                `"${formatted.flightType.replace(/"/g, '""')}"`, // Raw flight type for CSV
                `"${formatted.aircraft.replace(/"/g, '""')}"`,
              ];
              csvContent += row.join(",") + "\n";
            });
        } else if (hasObservationText) {
            csvContent += `"No hay turnos programados para esta fecha."\n`;
        }
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
    const pageTitle = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })}${exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}`;
    let currentY = 15;
    let pageBreakAddedForPreviousDay = false;

    doc.setFontSize(16);
    doc.text(pageTitle, 14, currentY);
    currentY += 10;

    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });

    dateInterval.forEach((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);

        const hasObservationText = observationForDay && observationForDay.observation_text && observationForDay.observation_text.trim() !== '';

        if (entriesForDay.length === 0 && !hasObservationText) {
            return; 
        }

        if (pageBreakAddedForPreviousDay) { 
            doc.addPage();
            currentY = 15;
            doc.setFontSize(16);
            doc.text(pageTitle, 14, currentY);
            currentY += 10;
        }
        pageBreakAddedForPreviousDay = false; 


        doc.setFontSize(14);
        doc.text(`Fecha: ${format(day, "PPP", { locale: es })}`, 14, currentY);
        currentY += 7;

        if (hasObservationText) {
            doc.setFontSize(10);
            const observationLines = doc.splitTextToSize(observationForDay!.observation_text!.trim(), doc.internal.pageSize.getWidth() - 28);
            doc.text("Observaciones:", 14, currentY);
            currentY += 5;
            observationLines.forEach((line: string) => {
                if (currentY > doc.internal.pageSize.getHeight() - 20) { 
                    doc.addPage();
                    currentY = 15;
                    doc.setFontSize(14);
                    doc.text(`Fecha: ${format(day, "PPP", { locale: es })} (cont.)`, 14, currentY);
                    currentY +=7;
                    doc.setFontSize(10);
                    doc.text("Observaciones (cont.):", 14, currentY);
                    currentY += 5;
                }
                doc.text(line, 14, currentY);
                currentY += 5;
            });
            currentY += 3; 
        }

        if (entriesForDay.length === 0) {
            if (hasObservationText) {
                doc.setFontSize(10);
                if (currentY > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); currentY = 15; }
                doc.text("No hay turnos programados para esta fecha.", 14, currentY);
                currentY += 10;
            }
        } else {
            const tableColumn = ["Hora", "Piloto", "Categoría", "Rem. Disp.", "Tipo Vuelo", "Aeronave"];
            const tableRows: (string | { content: string; colSpan?: number; styles?: any } | null)[][] = []; // Adjusted type
            
            let previousGroupIdentifier: string | null = null;
            
            entriesForDay.forEach(entry => {
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
                const flightTypeCell = formatted.shouldFlightTypeBeBold 
                    ? { content: formatted.flightType, styles: { fontStyle: 'bold' } } 
                    : formatted.flightType;
                tableRows.push([
                    formatted.time,
                    formatted.pilot,
                    formatted.category,
                    formatted.towAvailable || '-',
                    flightTypeCell,
                    formatted.aircraft,
                ]);
            });
            
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 }, // Blue header
                styles: { fontSize: 8, cellPadding: 1.5 },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 25 },
                    4: { cellWidth: 30 },
                    5: { cellWidth: 'auto' },
                },
                didDrawPage: (dataAfterPage) => { 
                    currentY = dataAfterPage.cursor?.y ?? currentY;
                    if (dataAfterPage.pageNumber > doc.getNumberOfPages()) { 
                         pageBreakAddedForPreviousDay = true; 
                    } else if ( dataAfterPage.pageNumber === doc.getNumberOfPages() && currentY < 20){ 
                         pageBreakAddedForPreviousDay = true;
                    }
                },
                didParseCell: function (data) {
                    if (data.row.raw && typeof data.row.raw[0] === 'object' && (data.row.raw[0] as any)?.colSpan) {
                        // This handles group header rows that are objects
                        const cellObject = data.row.raw[0] as { content: string; styles: any; colSpan?: number };
                        if (cellObject.styles) {
                            Object.assign(data.cell.styles, cellObject.styles);
                        }
                        if (cellObject.colSpan) {
                            data.cell.colSpan = cellObject.colSpan;
                        }
                    } else if (data.column.dataKey === '4' && typeof data.cell.raw === 'object' && data.cell.raw !== null && 'styles' in data.cell.raw) {
                        // This handles individual styled cells like bold flight type
                        const cellObject = data.cell.raw as { content: string; styles: any };
                         if (cellObject.styles) {
                            Object.assign(data.cell.styles, cellObject.styles);
                        }
                        data.cell.text = cellObject.content; // Ensure text is set correctly
                    }
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10; 
            if (currentY > doc.internal.pageSize.getHeight() -20) { 
                pageBreakAddedForPreviousDay = true;
            }

        }
        if (entriesForDay.length > 0 || hasObservationText) { 
            pageBreakAddedForPreviousDay = true; 
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
      <DropdownMenuContent align="end" className="w-72">
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
