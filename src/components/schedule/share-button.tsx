
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Share2, FileSpreadsheet, FileText, Download, CalendarIcon, Loader2, AlertTriangle } from "lucide-react"; // Added AlertTriangle
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
  scheduleDate: Date; // This is the initial date, range can be different
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
): { id: string; name: string; order: number } => {
  const instructorCategory = categories.find(c => c.name === 'Instructor');
  const remolcadorCategory = categories.find(c => c.name === 'Remolcador');

  if (entry.pilot_category_id === instructorCategory?.id) {
    return { id: 'instructor', name: 'Instructores', order: 1 };
  }
  if (entry.pilot_category_id === remolcadorCategory?.id) {
    if (entry.is_tow_pilot_available) {
      return { id: 'remolcador_disponible', name: 'Pilotos Remolcadores (Disponibles)', order: 2 };
    }
    return { id: 'remolcador_no_disponible', name: 'Pilotos Remolcadores (No Disponibles)', order: 3 };
  }
  if (entry.aircraft_id) {
    return { id: `aircraft_${entry.aircraft_id}`, name: `Aeronave: ${getAircraftName(entry.aircraft_id)}`, order: 4 };
  }
  return { id: 'sin_aeronave', name: 'Vuelos sin Aeronave Asignada', order: 5 };
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
  
  useEffect(() => {
    setExportStartDate(scheduleDate);
    setExportEndDate(scheduleDate);
  }, [scheduleDate]);


  const getFormattedEntry = (entry: ScheduleEntry) => {
    const pilotName = getPilotName(entry.pilot_id);
    const pilotCategoryNameForTurn = getCategoryName(entry.pilot_category_id);
    const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flight_type_id)?.name || 'N/A';
    const aircraftText = entry.aircraft_id ? getAircraftName(entry.aircraft_id) : 'N/A';
    
    let towPilotStatus = '';
    const remolcadorCategoryDetails = categories.find(c => c.name === 'Remolcador');
    if (entry.pilot_category_id === remolcadorCategoryDetails?.id) {
      towPilotStatus = entry.is_tow_pilot_available ? 'Sí' : 'No';
    }

    const instructorCategoryDetails = categories.find(c => c.name === 'Instructor');
    const isInstructionByInstructor = entry.flight_type_id === 'instruction' && entry.pilot_category_id === instructorCategoryDetails?.id;
    const isTurnByRemolcador = entry.pilot_category_id === remolcadorCategoryDetails?.id;

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

      const [entriesData, observationsData] = await Promise.all([
        fetchScheduleEntriesForRange(startDateStr, endDateStr),
        fetchObservationsForRange(startDateStr, endDateStr)
      ]);

      if (entriesData === null || observationsData === null) {
        toast({ title: "Error al obtener datos", description: "No se pudieron cargar los datos para el rango seleccionado.", variant: "destructive" });
        return null;
      }
      
      // Pre-sort entries by date and then by custom logic
      const instructorCategory = categories.find(c => c.name === 'Instructor');
      const remolcadorCategory = categories.find(c => c.name === 'Remolcador');

      const sortedEntries = [...entriesData].sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date);
        if (dateComparison !== 0) return dateComparison;

        const aIsInstructor = a.pilot_category_id === instructorCategory?.id;
        const bIsInstructor = b.pilot_category_id === instructorCategory?.id;
        if (aIsInstructor && !bIsInstructor) return -1;
        if (!aIsInstructor && bIsInstructor) return 1;
        if (aIsInstructor && bIsInstructor) return a.start_time.localeCompare(b.start_time);

        const aIsRemolcador = a.pilot_category_id === remolcadorCategory?.id;
        const bIsRemolcador = b.pilot_category_id === remolcadorCategory?.id;
        if (aIsRemolcador && !bIsRemolcador) return -1;
        if (!aIsRemolcador && bIsRemolcador) return 1;
        if (aIsRemolcador && bIsRemolcador) {
          const aIsConfirmedTow = a.is_tow_pilot_available === true;
          const bIsConfirmedTow = b.is_tow_pilot_available === true;
          if (aIsConfirmedTow && !bIsConfirmedTow) return -1;
          if (!aIsConfirmedTow && bIsConfirmedTow) return 1;
          return a.start_time.localeCompare(b.start_time);
        }
        
        const aHasAircraft = !!a.aircraft_id;
        const bHasAircraft = !!b.aircraft_id;
        if (aHasAircraft && !bHasAircraft) return -1;
        if (!aHasAircraft && bHasAircraft) return 1;
        if (aHasAircraft && bHasAircraft && a.aircraft_id && b.aircraft_id) {
            const aircraftComparison = (a.aircraft_id).localeCompare(b.aircraft_id);
            if (aircraftComparison !== 0) return aircraftComparison;
        }

        const timeComparison = a.start_time.localeCompare(b.start_time);
        if (timeComparison !== 0) return timeComparison;

        const aIsSport = a.flight_type_id === 'sport';
        const bIsSport = b.flight_type_id === 'sport';
        if (aIsSport && !bIsSport) return -1; // Sport flights first
        if (!aIsSport && bIsSport) return 1;
        
        return 0;
      });
      return { entries: sortedEntries, observations: observationsData };

    } catch (error) {
      console.error("Error fetching data for export:", error);
      toast({ title: "Error", description: "Ocurrió un error al obtener los datos para exportar.", variant: "destructive" });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [exportStartDate, exportEndDate, fetchScheduleEntriesForRange, fetchObservationsForRange, toast, categories]);


  const generateShareTextForRange = (allEntries: ScheduleEntry[], allObservations: DailyObservation[]) => {
    if (!exportStartDate || !exportEndDate) return "Rango de fechas no seleccionado.";

    let fullText = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })}${exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}\n`;
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    let contentAddedForPreviousDay = false;

    dateInterval.forEach((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const observationForDay = allObservations.find(obs => obs.date === dayStr);
      const entriesForDay = allEntries.filter(entry => entry.date === dayStr);

      const hasObservationText = observationForDay && observationForDay.observation_text && observationForDay.observation_text.trim() !== '';
      
      // Warnings logic for the current day
      const towPilotCategory = categories.find(cat => cat.name === 'Remolcador');
      const instructorCategory = categories.find(cat => cat.name === 'Instructor');
      const towageFlightTypeId = FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;

      const isTowPilotCategoryConfirmedForDay = towPilotCategory 
        ? entriesForDay.some(entry => entry.pilot_category_id === towPilotCategory.id && entry.is_tow_pilot_available === true) 
        : true; // Default to true if category "Remolcador" doesn't exist, to prevent false warning

      const isInstructorConfirmedForDay = instructorCategory 
        ? entriesForDay.some(entry => entry.pilot_category_id === instructorCategory.id) 
        : true; // Default to true if category "Instructor" doesn't exist

      const noTowageFlightsPresentForDay = towageFlightTypeId 
        ? !entriesForDay.some(entry => entry.flight_type_id === towageFlightTypeId) 
        : false; // Default to false if type "Remolque" doesn't exist

      if (entriesForDay.length === 0 && !hasObservationText && isTowPilotCategoryConfirmedForDay && isInstructorConfirmedForDay && !noTowageFlightsPresentForDay) {
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

      // Add warnings to text export
      let warningsText = "";
      if (towPilotCategory && !isTowPilotCategoryConfirmedForDay) {
        warningsText += `Aviso: Aún no hay piloto de categoría "Remolcador" confirmado para esta fecha.\n`;
      }
      if (instructorCategory && !isInstructorConfirmedForDay) {
        warningsText += `Aviso: Aún no hay instructor confirmado para esta fecha.\n`;
      }
      if (towageFlightTypeId && noTowageFlightsPresentForDay && entriesForDay.length > 0) { // Only show if there are other flights
        warningsText += `*Aviso: Aún no hay Remolcador (tipo de vuelo) confirmado para esta fecha.*\n`;
      }
      if (warningsText) {
        fullText += `\n${warningsText}`;
      }


      if (entriesForDay.length === 0) {
          fullText += "No hay turnos programados para esta fecha.\n";
      } else {
        let previousGroupIdentifier: string | null = null;
        
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
        // console.error("Error al compartir:", err);
        try {
          await navigator.clipboard.writeText(shareText);
          toast({ title: "Agenda copiada", description: "No se pudo compartir, la agenda se copió al portapapeles." });
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
        
        const towPilotCategory = categories.find(cat => cat.name === 'Remolcador');
        const instructorCategory = categories.find(cat => cat.name === 'Instructor');
        const towageFlightTypeId = FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;

        const isTowPilotCategoryConfirmedForDay = towPilotCategory ? entriesForDay.some(entry => entry.pilot_category_id === towPilotCategory.id && entry.is_tow_pilot_available === true) : true;
        const isInstructorConfirmedForDay = instructorCategory ? entriesForDay.some(entry => entry.pilot_category_id === instructorCategory.id) : true;
        const noTowageFlightsPresentForDay = towageFlightTypeId ? !entriesForDay.some(entry => entry.flight_type_id === towageFlightTypeId) : false;

        if (entriesForDay.length === 0 && !hasObservationText && isTowPilotCategoryConfirmedForDay && isInstructorConfirmedForDay && !noTowageFlightsPresentForDay) {
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
        
        // Add warnings to CSV export
        if (towPilotCategory && !isTowPilotCategoryConfirmedForDay) {
          csvContent += `"Aviso: Aún no hay piloto de categoría 'Remolcador' confirmado para esta fecha."\n`;
        }
        if (instructorCategory && !isInstructorConfirmedForDay) {
          csvContent += `"Aviso: Aún no hay instructor confirmado para esta fecha."\n`;
        }
        if (towageFlightTypeId && noTowageFlightsPresentForDay && entriesForDay.length > 0) {
          csvContent += `"Aviso: Aún no hay Remolcador (tipo de vuelo) confirmado para esta fecha."\n`;
        }


        if (entriesForDay.length > 0) {
            csvContent += headers.join(",") + "\n";

            let previousGroupIdentifier: string | null = null;
            
            entriesForDay.forEach((entry) => {
              const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
              if (groupDetails.id !== previousGroupIdentifier) {
                csvContent += `"${groupDetails.name.replace(/"/g, '""')}"\n`; 
                previousGroupIdentifier = groupDetails.id;
              }
              const formatted = getFormattedEntry(entry);
              const row = [
                formatted.time,
                `"${formatted.pilot.replace(/"/g, '""')}"`,
                `"${formatted.category.replace(/"/g, '""')}"`,
                formatted.towAvailable,
                `"${(formatted.shouldFlightTypeBeBold ? `${formatted.flightType}` : formatted.flightType).replace(/"/g, '""')}"`,
                `"${formatted.aircraft.replace(/"/g, '""')}"`,
              ];
              csvContent += row.join(",") + "\n";
            });
        } else if (hasObservationText || !(isTowPilotCategoryConfirmedForDay && isInstructorConfirmedForDay && !noTowageFlightsPresentForDay) ) {
             // Add this if there were observations or if any warning was applicable, even if no entries
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

    dateInterval.forEach((day, dayIndex) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);

        const hasObservationText = observationForDay && observationForDay.observation_text && observationForDay.observation_text.trim() !== '';
        
        const towPilotCategory = categories.find(cat => cat.name === 'Remolcador');
        const instructorCategory = categories.find(cat => cat.name === 'Instructor');
        const towageFlightTypeId = FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;

        const isTowPilotCategoryConfirmedForDay = towPilotCategory ? entriesForDay.some(entry => entry.pilot_category_id === towPilotCategory.id && entry.is_tow_pilot_available === true) : true;
        const isInstructorConfirmedForDay = instructorCategory ? entriesForDay.some(entry => entry.pilot_category_id === instructorCategory.id) : true;
        const noTowageFlightsPresentForDay = towageFlightTypeId ? !entriesForDay.some(entry => entry.flight_type_id === towageFlightTypeId) : false;

        if (entriesForDay.length === 0 && !hasObservationText && isTowPilotCategoryConfirmedForDay && isInstructorConfirmedForDay && !noTowageFlightsPresentForDay) {
            return; 
        }

        if (pageBreakAddedForPreviousDay || dayIndex > 0) { // Add page for subsequent days if content was added for previous
            doc.addPage();
            currentY = 15;
            doc.setFontSize(16);
            doc.text(pageTitle, 14, currentY); // Repeat main title on new page
            currentY += 10;
        }
        pageBreakAddedForPreviousDay = false; 


        doc.setFontSize(14);
        doc.text(`Fecha: ${format(day, "PPP", { locale: es })}`, 14, currentY);
        currentY += 7;

        if (hasObservationText) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const observationLines = doc.splitTextToSize(observationForDay!.observation_text!.trim(), doc.internal.pageSize.getWidth() - 28);
            doc.text("Observaciones:", 14, currentY);
            currentY += 5;
            observationLines.forEach((line: string) => {
                if (currentY > doc.internal.pageSize.getHeight() - 20) { 
                    doc.addPage(); currentY = 15;
                    doc.setFontSize(14); doc.text(`Fecha: ${format(day, "PPP", { locale: es })} (cont.)`, 14, currentY); currentY +=7;
                    doc.setFontSize(10); doc.text("Observaciones (cont.):", 14, currentY); currentY += 5;
                }
                doc.text(line, 14, currentY);
                currentY += 5;
            });
            currentY += 3; 
        }

        // Add warnings to PDF export
        let warningAddedToPdf = false;
        doc.setFontSize(9);
        doc.setTextColor(200, 0, 0); // Red color for warnings, can be adjusted
        
        if (towPilotCategory && !isTowPilotCategoryConfirmedForDay) {
            if (currentY > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); currentY = 20; }
            doc.setFont('helvetica', 'bold');
            doc.text(`Aviso: Aún no hay piloto de categoría "Remolcador" confirmado para esta fecha.`, 14, currentY);
            doc.setFont('helvetica', 'normal');
            currentY += 5;
            warningAddedToPdf = true;
        }
        if (instructorCategory && !isInstructorConfirmedForDay) {
            if (currentY > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); currentY = 20; }
            doc.setFont('helvetica', 'bold');
            doc.text(`Aviso: Aún no hay instructor confirmado para esta fecha.`, 14, currentY);
            doc.setFont('helvetica', 'normal');
            currentY += 5;
            warningAddedToPdf = true;
        }
        if (towageFlightTypeId && noTowageFlightsPresentForDay && entriesForDay.length > 0) {
            if (currentY > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); currentY = 20; }
            doc.setFont('helvetica', 'bold');
            doc.text(`Aviso: Aún no hay Remolcador (tipo de vuelo) confirmado para esta fecha.`, 14, currentY);
            doc.setFont('helvetica', 'normal');
            currentY += 5;
            warningAddedToPdf = true;
        }
        doc.setTextColor(0, 0, 0); // Reset text color
        if (warningAddedToPdf) currentY +=2; // Extra space after warnings block


        if (entriesForDay.length === 0) {
            if (hasObservationText || warningAddedToPdf) { // If there were obs or warnings, state no entries
                doc.setFontSize(10);
                if (currentY > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); currentY = 15; }
                doc.text("No hay turnos programados para esta fecha.", 14, currentY);
                currentY += 10;
            }
        } else {
            const tableColumn = ["Hora", "Piloto", "Categoría", "Rem. Disp.", "Tipo Vuelo", "Aeronave"];
            const tableRows: (string | { content: string; colSpan?: number; styles?: any } | null)[][] = [];
            
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
                headStyles: { fillColor: [41, 128, 185], textColor: 255 }, 
                styles: { fontSize: 8, cellPadding: 1.5 },
                columnStyles: {
                    0: { cellWidth: 18 }, // Hora
                    1: { cellWidth: 'auto' }, // Piloto
                    2: { cellWidth: 30 }, // Categoría
                    3: { cellWidth: 22 }, // Rem. Disp.
                    4: { cellWidth: 28 }, // Tipo Vuelo
                    5: { cellWidth: 'auto' }, // Aeronave
                },
                didDrawPage: (dataAfterPage) => { 
                    currentY = dataAfterPage.cursor?.y ?? currentY;
                     if (dataAfterPage.pageNumber > doc.getNumberOfPages()) { 
                         pageBreakAddedForPreviousDay = true; 
                    } else if ( dataAfterPage.pageNumber === doc.getNumberOfPages() && currentY < 20){ 
                         pageBreakAddedForPreviousDay = true;
                    } else if (dataAfterPage.cursor && dataAfterPage.cursor.y < 20 && dataAfterPage.pageNumber > 1) { // Check if cursor reset to top on new page
                        pageBreakAddedForPreviousDay = true;
                    }
                },
                didParseCell: function (hookData) {
                    if (hookData.row.raw && typeof hookData.row.raw[0] === 'object' && (hookData.row.raw[0] as any)?.colSpan) {
                        const cellObject = hookData.row.raw[0] as { content: string; styles: any; colSpan?: number };
                        if (cellObject.styles) Object.assign(hookData.cell.styles, cellObject.styles);
                        if (cellObject.colSpan) hookData.cell.colSpan = cellObject.colSpan;
                    } else if (hookData.column.dataKey === '4' && typeof hookData.cell.raw === 'object' && hookData.cell.raw !== null && 'styles' in hookData.cell.raw) {
                        const cellObject = hookData.cell.raw as { content: string; styles: any };
                         if (cellObject.styles) Object.assign(hookData.cell.styles, cellObject.styles);
                        hookData.cell.text = cellObject.content;
                    }
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10; 
            if (currentY > doc.internal.pageSize.getHeight() - 20 || entriesForDay.length > 0) { // If table ended near bottom or had content, flag for page break
                pageBreakAddedForPreviousDay = true;
            }

        }
        if (entriesForDay.length > 0 || hasObservationText || warningAddedToPdf) { 
            pageBreakAddedForPreviousDay = true; 
        } else {
            pageBreakAddedForPreviousDay = false; // No content for this day, no page break needed before next
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

