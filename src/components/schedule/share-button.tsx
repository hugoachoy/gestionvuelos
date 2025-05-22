
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
import { Share2, FileSpreadsheet, FileText, Download, CalendarIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ScheduleEntry, PilotCategory, DailyObservation, Pilot } from "@/types"; // Added Pilot
import { 
    usePilotsStore, 
    usePilotCategoriesStore, 
    useAircraftStore, 
    useScheduleStore, 
    useDailyObservationsStore 
} from '@/store/data-hooks';
import { FLIGHT_TYPES } from '@/types';
import { format, eachDayOfInterval, parseISO, isValid as isValidDate, isBefore, differenceInDays, startOfDay } from 'date-fns'; // Added date-fns functions
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
  const { pilots, getPilotName } = usePilotsStore(); // Destructure pilots
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

  const getFormattedEntry = (entry: ScheduleEntry, allPilots: Pilot[]) => {
    const pilotName = getPilotName(entry.pilot_id);
    const pilotCategoryNameForTurn = getCategoryName(entry.pilot_category_id);
    const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flight_type_id)?.name || 'N/A';
    const aircraftText = entry.aircraft_id ? getAircraftName(entry.aircraft_id) : 'N/A';
    
    let towPilotStatus = '';
    const entryCategoryDetails = categories.find(c => c.id === entry.pilot_category_id);
    const isTurnByInstructor = entryCategoryDetails?.name === 'Instructor';
    const isTurnByRemolcador = entryCategoryDetails?.name === 'Remolcador';

    if (isTurnByRemolcador) {
      towPilotStatus = entry.is_tow_pilot_available ? 'Sí' : 'No';
    }
    
    const shouldFlightTypeBeBold =
      (entry.flight_type_id === 'instruction' && isTurnByInstructor) ||
      isTurnByRemolcador;

    let medicalWarningText = "";
    let medicalWarningSeverity: 'critical' | 'warning' | 'none' = 'none';
    const pilot = allPilots.find(p => p.id === entry.pilot_id);

    if (pilot && pilot.medical_expiry) {
      const medicalExpiryDate = parseISO(pilot.medical_expiry);
      const entryDateObj = parseISO(entry.date);
      const todayNormalized = startOfDay(new Date());

      if (isValidDate(medicalExpiryDate) && isValidDate(entryDateObj)) {
        const entryDateNormalized = startOfDay(entryDateObj);
        const isExpiredOnEntryDate = isBefore(medicalExpiryDate, entryDateNormalized);
        const daysUntilExpiryFromToday = differenceInDays(medicalExpiryDate, todayNormalized);
        const formattedExpiry = format(medicalExpiryDate, "dd/MM/yy", { locale: es });

        if (isExpiredOnEntryDate) {
          medicalWarningText = `PF VENCIDO (${formattedExpiry})`;
          medicalWarningSeverity = 'critical';
        } else {
          if (daysUntilExpiryFromToday <= 30) {
            medicalWarningText = `PF Vence ${formattedExpiry} (${daysUntilExpiryFromToday}d)`;
            medicalWarningSeverity = 'critical';
          } else if (daysUntilExpiryFromToday <= 60) {
            medicalWarningText = `PF Vence ${formattedExpiry} (${daysUntilExpiryFromToday}d)`;
            medicalWarningSeverity = 'warning';
          }
        }
      }
    }

    return {
      time: entry.start_time.substring(0, 5),
      pilot: pilotName,
      category: pilotCategoryNameForTurn,
      towAvailable: towPilotStatus,
      flightType: flightTypeName,
      aircraft: aircraftText,
      shouldFlightTypeBeBold,
      medicalWarningText,
      medicalWarningSeverity,
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
      
        const aIsTowPilot = a.pilot_category_id === remolcadorCategory?.id;
        const bIsTowPilot = b.pilot_category_id === remolcadorCategory?.id;
        const aIsConfirmedTow = a.is_tow_pilot_available === true;
        const bIsConfirmedTow = b.is_tow_pilot_available === true;
      
        if (aIsTowPilot && aIsConfirmedTow && !(bIsTowPilot && bIsConfirmedTow)) return -1;
        if (!(aIsTowPilot && aIsConfirmedTow) && (bIsTowPilot && bIsConfirmedTow)) return 1;
        if (aIsTowPilot && aIsConfirmedTow && bIsTowPilot && bIsConfirmedTow) {
          return a.start_time.localeCompare(b.start_time);
        }
      
        if (aIsTowPilot && !aIsConfirmedTow && !(bIsTowPilot && !bIsConfirmedTow)) return -1;
        if (!(aIsTowPilot && !aIsConfirmedTow) && (bIsTowPilot && !bIsConfirmedTow)) return 1;
        if (aIsTowPilot && !aIsConfirmedTow && bIsTowPilot && !bIsConfirmedTow) {
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
        if (aIsSport && !bIsSport) return -1;
        if (!aIsSport && bIsSport) return 1;
        
        return 0;
      });
      return { entries: sortedEntries, observations: observationsData, allPilots: pilots };

    } catch (error) {
      console.error("Error fetching data for export:", error);
      toast({ title: "Error", description: "Ocurrió un error al obtener los datos para exportar.", variant: "destructive" });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [exportStartDate, exportEndDate, fetchScheduleEntriesForRange, fetchObservationsForRange, toast, categories, pilots]);


  const formatTextForExport = (text: string) => {
    return text.replace(/\b(Instructor|Remolcador)\b/gi, (match) => `_${match}_`);
  };

  const generateShareTextForRange = (allEntries: ScheduleEntry[], allObservations: DailyObservation[], allPilots: Pilot[]) => {
    if (!exportStartDate || !exportEndDate) return "Rango de fechas no seleccionado.";

    let fullText = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })}${exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}\n`;
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    let contentAddedForPreviousDay = false;

    dateInterval.forEach((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const entriesForDay = allEntries.filter(entry => entry.date === dayStr);
      const observationForDay = allObservations.find(obs => obs.date === dayStr);
      const hasObservationText = observationForDay?.observation_text && observationForDay.observation_text.trim() !== '';

      const remolcadorCategory = categories.find(cat => cat.name === 'Remolcador');
      const instructorCategory = categories.find(cat => cat.name === 'Instructor');
      const towageFlightTypeId = FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;

      const isRemolcadorCategoryConfirmedForDay = remolcadorCategory 
        ? entriesForDay.some(entry => entry.pilot_category_id === remolcadorCategory.id && entry.is_tow_pilot_available === true) 
        : true; 
      const isInstructorCategoryConfirmedForDay = instructorCategory 
        ? entriesForDay.some(entry => entry.pilot_category_id === instructorCategory.id) 
        : true; 
      const noTowageFlightsPresentForDay = towageFlightTypeId 
        ? !entriesForDay.some(entry => entry.flight_type_id === towageFlightTypeId && entriesForDay.length > 0) 
        : false;
      
      const dayHasData = entriesForDay.length > 0 || hasObservationText ||
        (categories.some(c => c.name === 'Remolcador') && !isRemolcadorCategoryConfirmedForDay) ||
        (categories.some(c => c.name === 'Instructor') && !isInstructorCategoryConfirmedForDay) ||
        (towageFlightTypeId && noTowageFlightsPresentForDay);

      if (!dayHasData) {
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

      let warningsText = "";
      if (categories.some(c => c.name === 'Remolcador') && !isRemolcadorCategoryConfirmedForDay) {
        warningsText += formatTextForExport('Aviso: Aún no hay piloto de categoría Remolcador confirmado para esta fecha.\n');
      }
      if (categories.some(c => c.name === 'Instructor') && !isInstructorCategoryConfirmedForDay) {
        warningsText += formatTextForExport('Aviso: Aún no hay Instructor confirmado para esta fecha.\n');
      }
      if (towageFlightTypeId && noTowageFlightsPresentForDay) {
        warningsText += 'Aviso: Aún no hay _Remolcador_ confirmado.\n'; 
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
            fullText += `\n--- ${formatTextForExport(groupDetails.name)} ---\n`;
            previousGroupIdentifier = groupDetails.id;
          }
          const formatted = getFormattedEntry(entry, allPilots);
          let flightTypeString = formatted.flightType;
          if (formatted.shouldFlightTypeBeBold) {
            flightTypeString = `*${formatted.flightType}*`; 
          }
          let pilotCategoryString = formatTextForExport(formatted.category);
          const medicalWarningString = formatted.medicalWarningText ? ` (${formatted.medicalWarningText})` : "";

          fullText += `${formatted.time} - ${formatted.pilot}${medicalWarningString} (${pilotCategoryString}${formatted.towAvailable ? ' - Rem: ' + formatted.towAvailable : ''}) - ${flightTypeString}${formatted.aircraft !== 'N/A' ? ' - Aeronave: ' + formatted.aircraft : ''}\n`;
        });
      }
    });
    return fullText;
  };

  const handleShareText = async () => {
    const data = await fetchDataForRange();
    if (!data) return;

    const shareText = generateShareTextForRange(data.entries, data.observations, data.allPilots);
    const shareData = {
      title: `Agenda de Vuelo: ${exportStartDate ? format(exportStartDate, "PPP", { locale: es }) : ''}${exportStartDate && exportEndDate && exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}`,
      text: shareText,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Agenda compartida", description: "La agenda se ha compartido exitosamente." });
      } catch (err) {
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
    const headers = ["Hora", "Piloto", "Advertencia Psicofísico", "Categoría", "Remolcador Disponible", "Tipo de Vuelo", "Aeronave"];
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    let contentAddedForPreviousDay = false;

    dateInterval.forEach((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const formattedDay = format(day, "dd/MM/yyyy", { locale: es });
        
        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const hasObservationText = observationForDay?.observation_text && observationForDay.observation_text.trim() !== '';
        const obsText = hasObservationText ? `"${observationForDay!.observation_text!.trim().replace(/"/g, '""')}"` : "";
        
        const remolcadorCategory = categories.find(cat => cat.name === 'Remolcador');
        const instructorCategory = categories.find(cat => cat.name === 'Instructor');
        const towageFlightTypeId = FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;

        const isRemolcadorCategoryConfirmedForDay = remolcadorCategory ? entriesForDay.some(entry => entry.pilot_category_id === remolcadorCategory.id && entry.is_tow_pilot_available === true) : true;
        const isInstructorCategoryConfirmedForDay = instructorCategory ? entriesForDay.some(entry => entry.pilot_category_id === instructorCategory.id) : true;
        const noTowageFlightsPresentForDay = towageFlightTypeId ? !entriesForDay.some(entry => entry.flight_type_id === towageFlightTypeId && entriesForDay.length > 0) : false;

        const dayHasData = entriesForDay.length > 0 || hasObservationText ||
          (categories.some(c => c.name === 'Remolcador') && !isRemolcadorCategoryConfirmedForDay) ||
          (categories.some(c => c.name === 'Instructor') && !isInstructorCategoryConfirmedForDay) ||
          (towageFlightTypeId && noTowageFlightsPresentForDay);

        if (!dayHasData) {
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
        
        let warningsText = "";
        if (categories.some(c => c.name === 'Remolcador') && !isRemolcadorCategoryConfirmedForDay) {
          warningsText += `"Aviso: Aún no hay piloto de categoría Remolcador confirmado para esta fecha."\n`;
        }
        if (categories.some(c => c.name === 'Instructor') && !isInstructorCategoryConfirmedForDay) {
          warningsText += `"Aviso: Aún no hay Instructor confirmado para esta fecha."\n`;
        }
        if (towageFlightTypeId && noTowageFlightsPresentForDay) {
          warningsText += `"Aviso: Aún no hay Remolcador confirmado."\n`;
        }
        if (warningsText) {
          csvContent += warningsText;
        }

        if (entriesForDay.length > 0) {
            csvContent += headers.join(",") + "\n";

            let previousGroupIdentifier: string | null = null;
            
            entriesForDay.forEach((entry) => {
              const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
              if (groupDetails.id !== previousGroupIdentifier) {
                csvContent += `"${groupDetails.name.replace(/"/g, '""')}",,,,,,\n`; 
                previousGroupIdentifier = groupDetails.id;
              }
              const formatted = getFormattedEntry(entry, data.allPilots);
              const row = [
                formatted.time,
                `"${formatted.pilot.replace(/"/g, '""')}"`,
                `"${formatted.medicalWarningText.replace(/"/g, '""')}"`,
                `"${formatted.category.replace(/"/g, '""')}"`,
                formatted.towAvailable,
                `"${(formatted.shouldFlightTypeBeBold ? `${formatted.flightType}` : formatted.flightType).replace(/"/g, '""')}"`,
                `"${formatted.aircraft.replace(/"/g, '""')}"`,
              ];
              csvContent += row.join(",") + "\n";
            });
        } else { 
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

    const addPdfWarningText = (text: string, isBold: boolean = false) => {
      if (currentY > doc.internal.pageSize.getHeight() - 15) { 
          doc.addPage(); currentY = 20; 
          const currentDayStr = data.entries.find(e => e.date === dayStr)?.date || dayStr || format(new Date(), "yyyy-MM-dd");
          doc.setFontSize(14); doc.text(`Fecha: ${format(parseISO(currentDayStr), "PPP", { locale: es })} (cont.)`, 14, currentY); currentY +=7;
      }
      doc.setFontSize(9);
      doc.setTextColor(150, 0, 0); // Darker red for warnings
      doc.setFont(undefined, isBold ? 'bold' : 'normal');
      doc.text(text, 14, currentY);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      currentY += 5;
    };
    
    let dayStr = ""; // Define dayStr in a scope accessible by addPdfWarningText if needed

    dateInterval.forEach((day, dayIndex) => {
        dayStr = format(day, "yyyy-MM-dd"); 
        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const hasObservationText = observationForDay && observationForDay.observation_text && observationForDay.observation_text.trim() !== '';
        
        const remolcadorCategory = categories.find(cat => cat.name === 'Remolcador');
        const instructorCategory = categories.find(cat => cat.name === 'Instructor');
        const towageFlightTypeId = FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;

        const isRemolcadorCategoryConfirmedForDay = remolcadorCategory ? entriesForDay.some(entry => entry.pilot_category_id === remolcadorCategory.id && entry.is_tow_pilot_available === true) : true;
        const isInstructorCategoryConfirmedForDay = instructorCategory ? entriesForDay.some(entry => entry.pilot_category_id === instructorCategory.id) : true;
        const noTowageFlightsPresentForDay = towageFlightTypeId ? !entriesForDay.some(entry => entry.flight_type_id === towageFlightTypeId && entriesForDay.length > 0) : false;

        const dayHasData = entriesForDay.length > 0 || hasObservationText ||
          (categories.some(c => c.name === 'Remolcador') && !isRemolcadorCategoryConfirmedForDay) ||
          (categories.some(c => c.name === 'Instructor') && !isInstructorCategoryConfirmedForDay) ||
          (towageFlightTypeId && noTowageFlightsPresentForDay);

        if (!dayHasData) {
          return;
        }

        if (pageBreakAddedForPreviousDay || (dayIndex > 0 && dayHasData)) { 
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
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0,0,0);
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
        
        if (categories.some(c => c.name === 'Remolcador') && !isRemolcadorCategoryConfirmedForDay) {
            addPdfWarningText('Aviso: Aún no hay piloto de categoría Remolcador confirmado para esta fecha.');
        }
        if (categories.some(c => c.name === 'Instructor') && !isInstructorCategoryConfirmedForDay) {
           addPdfWarningText('Aviso: Aún no hay Instructor confirmado para esta fecha.');
        }
        if (towageFlightTypeId && noTowageFlightsPresentForDay) {
           addPdfWarningText('Aviso: Aún no hay Remolcador confirmado.', true); // Pass true for bold
        }
        doc.setTextColor(0, 0, 0); 
        if ( (categories.some(c => c.name === 'Remolcador') && !isRemolcadorCategoryConfirmedForDay) ||
             (categories.some(c => c.name === 'Instructor') && !isInstructorCategoryConfirmedForDay) ||
             (towageFlightTypeId && noTowageFlightsPresentForDay)
           ) {
            currentY +=2; 
        }

        if (entriesForDay.length === 0) {
            doc.setFontSize(10);
            if (currentY > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); currentY = 15; }
            doc.text("No hay turnos programados para esta fecha.", 14, currentY);
            currentY += 10;
        } else {
            const tableColumn = ["Hora", "Piloto", "Adv. Psicof.", "Categoría", "Rem. Disp.", "Tipo Vuelo", "Aeronave"];
            const tableRows: (string | { content: string; colSpan?: number; styles?: any } | null)[][] = [];
            
            let previousGroupIdentifier: string | null = null;
            
            entriesForDay.forEach(entry => {
                const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
                let groupHeaderStyle: any = { fontStyle: 'bold', fillColor: [214, 234, 248], textColor: [21, 67, 96] };
                
                if (groupDetails.id !== previousGroupIdentifier) {
                    tableRows.push([
                        {
                        content: groupDetails.name,
                        colSpan: tableColumn.length,
                        styles: groupHeaderStyle,
                        },
                    ]);
                    previousGroupIdentifier = groupDetails.id;
                }
                const formatted = getFormattedEntry(entry, data.allPilots);
                const flightTypeCell = formatted.shouldFlightTypeBeBold 
                    ? { content: formatted.flightType, styles: { fontStyle: 'bold' } } 
                    : formatted.flightType;
                
                const medicalCellStyles: any = {};
                if (formatted.medicalWarningSeverity === 'critical') {
                    medicalCellStyles.textColor = [255, 0, 0]; // Red
                } else if (formatted.medicalWarningSeverity === 'warning') {
                    medicalCellStyles.textColor = [230, 126, 34]; // Dark yellow/orange
                }
                const medicalCell = { content: formatted.medicalWarningText, styles: medicalCellStyles };

                tableRows.push([
                    formatted.time,
                    formatted.pilot,
                    medicalCell,
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
                    0: { cellWidth: 15 }, 
                    1: { cellWidth: 'auto' }, 
                    2: { cellWidth: 30 }, // Adv. Psicof.
                    3: { cellWidth: 28 }, 
                    4: { cellWidth: 20 }, 
                    5: { cellWidth: 25 }, 
                    6: { cellWidth: 'auto' }, 
                },
                didDrawPage: (dataAfterPage) => { 
                    currentY = dataAfterPage.cursor?.y ?? currentY;
                     if (dataAfterPage.pageNumber > doc.getNumberOfPages()) { 
                         pageBreakAddedForPreviousDay = true; 
                    } else if ( dataAfterPage.pageNumber === doc.getNumberOfPages() && currentY < 20){ 
                         pageBreakAddedForPreviousDay = true;
                    } else if (dataAfterPage.cursor && dataAfterPage.cursor.y < 20 && dataAfterPage.pageNumber > 1) { 
                        pageBreakAddedForPreviousDay = true;
                    }
                },
                didParseCell: function (hookData) {
                    // Group Headers
                    if (hookData.row.raw && typeof hookData.row.raw[0] === 'object' && (hookData.row.raw[0] as any)?.colSpan) {
                        const cellObject = hookData.row.raw[0] as { content: string; styles: any; colSpan?: number };
                        if (cellObject.styles) Object.assign(hookData.cell.styles, cellObject.styles);
                        if (cellObject.colSpan) hookData.cell.colSpan = cellObject.colSpan;
                    } 
                    // Flight Type and Medical Warning cells
                    else if (hookData.cell.raw && typeof hookData.cell.raw === 'object' && hookData.cell.raw !== null && 'styles' in hookData.cell.raw) {
                        const cellObject = hookData.cell.raw as { content: string; styles: any };
                         if (cellObject.styles) Object.assign(hookData.cell.styles, cellObject.styles);
                        hookData.cell.text = cellObject.content; // Ensure text is correctly set from content
                    }
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10; 
            if (currentY > doc.internal.pageSize.getHeight() - 20 || entriesForDay.length > 0) { 
                pageBreakAddedForPreviousDay = true;
            }
        }
        if (dayHasData) { 
            pageBreakAddedForPreviousDay = true; 
        } else {
            pageBreakAddedForPreviousDay = false; 
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
