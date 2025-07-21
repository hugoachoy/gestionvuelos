
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
import type { ScheduleEntry, PilotCategory, DailyObservation, Pilot, DailyNews, Aircraft } from "@/types";
import { 
    usePilotsStore, 
    usePilotCategoriesStore, 
    useAircraftStore, 
    useScheduleStore, 
    useDailyObservationsStore,
    useDailyNewsStore
} from '@/store/data-hooks';
import { FLIGHT_TYPES } from '@/types';
import { format, eachDayOfInterval, parseISO, isValid as isValidDate, isBefore, differenceInDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  scheduleDate: Date; 
}

// Helper for normalization within this component's scope for grouping
const normalizeCategoryNameForGrouping = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

// Constants for normalized category names for grouping
const NORMALIZED_INSTRUCTOR_AVION_FOR_GROUPING = "instructor avion";
const NORMALIZED_INSTRUCTOR_PLANEADOR_FOR_GROUPING = "instructor planeador";
const NORMALIZED_REMOLCADOR_FOR_GROUPING = "remolcador";


const getEntryGroupDetails = (
  entry: ScheduleEntry,
  categories: PilotCategory[],
): { id: string; name: string; order: number } => {
  const pilotCategoryDetails = categories.find(c => c.id === entry.pilot_category_id);
  const normalizedCategoryName = normalizeCategoryNameForGrouping(pilotCategoryDetails?.name);

  if (normalizedCategoryName === NORMALIZED_REMOLCADOR_FOR_GROUPING) {
    return { id: 'remolcadores', name: 'Remolcador/es', order: 1 };
  }
  if (normalizedCategoryName === NORMALIZED_INSTRUCTOR_AVION_FOR_GROUPING || normalizedCategoryName === NORMALIZED_INSTRUCTOR_PLANEADOR_FOR_GROUPING) {
    return { id: 'instructor', name: 'Instructores', order: 2 };
  }
  return { id: 'pilotos', name: 'Pilotos', order: 3 };
};

const getSortSubPriorityForExport = (
  entry: ScheduleEntry,
  allAircraft: Aircraft[]
): number => {
  const flightTypeId = entry.flight_type_id;
  const aircraftDetails = allAircraft.find(a => a.id === entry.aircraft_id);
  const aircraftType = aircraftDetails?.type;

  // These numbers are sub-priorities *within the "Piloto" group*
  if (flightTypeId === 'instruction_taken') {
      if (aircraftType === 'Glider') return 1; // Piloto Planeador - Instrucción
      if (aircraftType === 'Tow Plane' || aircraftType === 'Avión') return 2; // Piloto Avión - Instrucción
      return 2; // Default
  }
  if (aircraftType === 'Glider') {
      if (flightTypeId === 'sport') return 3; // Piloto Planeador - Deportivo
      if (flightTypeId === 'local') return 4; // Piloto Planeador - Local
  }
  if (aircraftType === 'Tow Plane' || aircraftType === 'Avión') {
      if (flightTypeId === 'sport') return 5; // Piloto Avión - Travesía (as sport)
      if (flightTypeId === 'local') return 6; // Piloto Avión - Local
  }
  return 99;
}


export function ShareButton({ scheduleDate }: ShareButtonProps) {
  const { toast } = useToast();
  const { pilots, getPilotName } = usePilotsStore();
  const { categories, getCategoryName } = usePilotCategoriesStore();
  const { aircraft, getAircraftName } = useAircraftStore();
  const { fetchScheduleEntriesForRange } = useScheduleStore();
  const { fetchObservationsForRange } = useDailyObservationsStore();
  const { fetchDailyNewsForRange } = useDailyNewsStore();

  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(scheduleDate);
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(scheduleDate);
  const [isExporting, setIsExporting] = useState(false);
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  
  useEffect(() => {
    setExportStartDate(scheduleDate);
    setExportEndDate(scheduleDate);
  }, [scheduleDate]);

  const getFormattedEntry = (entry: ScheduleEntry, allPilots: Pilot[], allEntriesForDay: ScheduleEntry[]) => {
    const pilotName = getPilotName(entry.pilot_id);
    const pilotCategoryNameForTurn = getCategoryName(entry.pilot_category_id);
    const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flight_type_id)?.name || 'N/A';
    const aircraftText = entry.aircraft_id ? getAircraftName(entry.aircraft_id) : 'N/A';
    
    let availableStatus = '-';
    const entryCategoryDetails = categories.find(c => c.id === entry.pilot_category_id);
    const normalizedEntryCategoryName = normalizeCategoryNameForGrouping(entryCategoryDetails?.name);
    
    if (normalizedEntryCategoryName === NORMALIZED_INSTRUCTOR_AVION_FOR_GROUPING || normalizedEntryCategoryName === NORMALIZED_INSTRUCTOR_PLANEADOR_FOR_GROUPING) {
      availableStatus = 'Sí';
    } else if (normalizedEntryCategoryName === NORMALIZED_REMOLCADOR_FOR_GROUPING) {
      availableStatus = entry.is_tow_pilot_available ? 'Sí' : 'No';
    }
    
    const shouldFlightTypeBeBoldForInstructorOrTow = 
      (entry.flight_type_id === 'instruction_given' && (normalizedEntryCategoryName === NORMALIZED_INSTRUCTOR_AVION_FOR_GROUPING || normalizedEntryCategoryName === NORMALIZED_INSTRUCTOR_PLANEADOR_FOR_GROUPING)) ||
      (normalizedEntryCategoryName === NORMALIZED_REMOLCADOR_FOR_GROUPING);

    const isSportFlight = flightTypeName.toLowerCase() === 'deportivo';

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
    
    const sportFlightId = FLIGHT_TYPES.find(ft => ft.id === 'sport')?.id;
    let sportConflictMessage = "";
    if (entry.aircraft_id && entry.flight_type_id !== sportFlightId) {
        const conflictingSportEntry = allEntriesForDay.find(
            otherEntry =>
                otherEntry.aircraft_id === entry.aircraft_id &&
                otherEntry.flight_type_id === sportFlightId &&
                otherEntry.id !== entry.id
        );

        if (conflictingSportEntry) {
            const sportPilotName = getPilotName(conflictingSportEntry.pilot_id);
            const aircraftName = getAircraftName(entry.aircraft_id);
            sportConflictMessage = `(Supeditado a vuelo deportivo de ${sportPilotName} en ${aircraftName})`;
        }
    }

    return {
      time: entry.start_time.substring(0, 5),
      pilot: pilotName,
      category: pilotCategoryNameForTurn,
      availableStatus: availableStatus,
      flightType: flightTypeName,
      aircraft: aircraftText,
      shouldFlightTypeBeBoldForInstructorOrTow,
      isSportFlight,
      medicalWarningText,
      medicalWarningSeverity,
      sportConflictMessage,
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

      const [entriesData, observationsData, newsData] = await Promise.all([
        fetchScheduleEntriesForRange(startDateStr, endDateStr),
        fetchObservationsForRange(startDateStr, endDateStr),
        fetchDailyNewsForRange(startDateStr, endDateStr)
      ]);

      if (entriesData === null || observationsData === null || newsData === null) {
        toast({ title: "Error al obtener datos", description: "No se pudieron cargar los datos para el rango seleccionado.", variant: "destructive" });
        return null;
      }
      
      const sortedEntries = [...entriesData].sort((a, b) => {
        const aGroupDetails = getEntryGroupDetails(a, categories);
        const bGroupDetails = getEntryGroupDetails(b, categories);
    
        if (aGroupDetails.order !== bGroupDetails.order) {
            return aGroupDetails.order - bGroupDetails.order;
        }
    
        // Sort within Remolcador group
        if (aGroupDetails.id === 'remolcadores') {
            if (a.is_tow_pilot_available && !b.is_tow_pilot_available) return -1;
            if (!a.is_tow_pilot_available && b.is_tow_pilot_available) return 1;
        }
    
        // Sort within Piloto group
        if (aGroupDetails.id === 'pilotos') {
            const subPriorityA = getSortSubPriorityForExport(a, aircraft);
            const subPriorityB = getSortSubPriorityForExport(b, aircraft);
            if (subPriorityA !== subPriorityB) {
                return subPriorityA - subPriorityB;
            }
        }
    
        return a.start_time.localeCompare(b.start_time);
      });
      return { entries: sortedEntries, observations: observationsData, newsItems: newsData, allPilots: pilots };

    } catch (error) {
      console.error("Error fetching data for export:", error);
      toast({ title: "Error", description: "Ocurrió un error al obtener los datos para exportar.", variant: "destructive" });
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [exportStartDate, exportEndDate, fetchScheduleEntriesForRange, fetchObservationsForRange, fetchDailyNewsForRange, toast, categories, pilots, aircraft]);


  const formatTextForExport = (text: string) => {
    const groupHeaders = ["Instructores", "Remolcador/es", "Pilotos"];
    if (groupHeaders.includes(text)) {
        return `*${text}*`;
    }
    return text;
  };

  const generateShareTextForRange = (allEntries: ScheduleEntry[], allObservations: DailyObservation[], allNewsItems: DailyNews[], allPilots: Pilot[]) => {
    if (!exportStartDate || !exportEndDate) return "Rango de fechas no seleccionado.";

    let fullText = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })}${exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}\n`;
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    let contentAddedForPreviousDay = false;

    dateInterval.forEach((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const entriesForDay = allEntries.filter(entry => entry.date === dayStr);
      const observationForDay = allObservations.find(obs => obs.date === dayStr);
      const newsForDay = allNewsItems.filter(news => news.date === dayStr);
      const hasObservationText = observationForDay?.observation_text && observationForDay.observation_text.trim() !== '';
      const hasNews = newsForDay.length > 0;

      const dayHasData = entriesForDay.length > 0 || hasObservationText || hasNews;
      if (!dayHasData) {
        return; 
      }
      
      if (contentAddedForPreviousDay) { 
         fullText += `\n`; 
      }
      
      if (exportStartDate.getTime() !== exportEndDate.getTime()) {
        fullText += `\n=== ${format(day, "PPP", { locale: es })} ===\n`;
      }
      contentAddedForPreviousDay = true;


      if (hasObservationText) {
        fullText += `\nObservaciones:\n${observationForDay!.observation_text!.trim()}\n`;
      }

      if (hasNews) {
        fullText += `\nNovedades:\n`;
        newsForDay.forEach(news => {
          const newsTime = news.created_at && isValidDate(parseISO(news.created_at)) ? format(parseISO(news.created_at), 'HH:mm', { locale: es }) : 'Hora desc.';
          fullText += `[${newsTime}] - ${news.pilot_full_name}: ${news.news_text.trim()}\n`;
        });
      }

      const remolcadorCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_REMOLCADOR_FOR_GROUPING);
      const instructorAvionCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_INSTRUCTOR_AVION_FOR_GROUPING);
      const instructorPlaneadorCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_INSTRUCTOR_PLANEADOR_FOR_GROUPING);
      
      const isRemolcadorConfirmedForDay = remolcadorCategoryDefinition 
        ? entriesForDay.some(entry => entry.pilot_category_id === remolcadorCategoryDefinition.id && entry.is_tow_pilot_available === true) 
        : true; 
      const isInstructorAvionConfirmedForDay = instructorAvionCategoryDefinition 
        ? entriesForDay.some(entry => entry.pilot_category_id === instructorAvionCategoryDefinition.id) 
        : true; 
      const isInstructorPlaneadorConfirmedForDay = instructorPlaneadorCategoryDefinition 
        ? entriesForDay.some(entry => entry.pilot_category_id === instructorPlaneadorCategoryDefinition.id) 
        : true; 
      
      let warningsText = "";
      if (remolcadorCategoryDefinition && !isRemolcadorConfirmedForDay) {
        warningsText += `*Aviso: Aún no hay REMOLCADOR confirmado para esta fecha.*\n`;
      }
      if (instructorAvionCategoryDefinition && !isInstructorAvionConfirmedForDay) {
        warningsText += `*Aviso: Aún no hay Instructor de Avión confirmado para esta fecha.*\n`;
      }
      if (instructorPlaneadorCategoryDefinition && !isInstructorPlaneadorConfirmedForDay) {
        warningsText += `*Aviso: Aún no hay Instructor de Planeador confirmado para esta fecha.*\n`;
      }

      if (warningsText) {
        fullText += `\n${warningsText}`;
      }


      if (entriesForDay.length === 0 && (hasObservationText || hasNews)) { 
          fullText += "No hay turnos programados para esta fecha.\n";
      } else if (entriesForDay.length > 0) {
        let previousGroupIdentifier: string | null = null;
        
        entriesForDay.forEach(entry => {
          const groupDetails = getEntryGroupDetails(entry, categories);
          if (groupDetails.id !== previousGroupIdentifier) {
            fullText += `\n--- ${formatTextForExport(groupDetails.name)} ---\n`;
            previousGroupIdentifier = groupDetails.id;
          }
          const formatted = getFormattedEntry(entry, allPilots, entriesForDay);
          
          let flightTypeString = formatted.flightType;
          if (formatted.shouldFlightTypeBeBoldForInstructorOrTow) {
            flightTypeString = `*${formatted.flightType}*`; 
          } else if (formatted.isSportFlight) {
            flightTypeString = `*${formatted.flightType}*`;
          }

          let pilotCategoryString = formatted.category; 
          const medicalWarningString = formatted.medicalWarningText ? ` (${formatted.medicalWarningText})` : "";
          
          fullText += `${formatted.time} - ${formatted.pilot}${medicalWarningString} (${pilotCategoryString}${formatted.availableStatus !== '-' ? ' - Disp: ' + formatted.availableStatus : ''}) - ${flightTypeString}${formatted.aircraft !== 'N/A' ? ' - Aeronave: ' + formatted.aircraft : ''}\n`;
          
          if (formatted.sportConflictMessage) {
            fullText += `  *${formatted.sportConflictMessage}*\n`;
          }
        });
      }
    });
    return fullText;
  };

  const handleShareText = async () => {
    const data = await fetchDataForRange();
    if (!data) return;

    const shareText = generateShareTextForRange(data.entries, data.observations, data.newsItems, data.allPilots);
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
    const headers = ["Hora", "Piloto", "Advertencia Psicofísico", "Categoría (Turno)", "Disponible", "Tipo de Vuelo", "Aeronave", "Advertencia V.D."];
    
    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    let contentAddedForPreviousDay = false;

    dateInterval.forEach((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const formattedDay = format(day, "dd/MM/yyyy", { locale: es });
        
        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const newsForDay = data.newsItems.filter(news => news.date === dayStr);
        const hasObservationText = observationForDay?.observation_text && observationForDay.observation_text.trim() !== '';
        const obsText = hasObservationText ? `"${observationForDay!.observation_text!.trim().replace(/"/g, '""')}"` : "";
        const hasNews = newsForDay.length > 0;
        
        const dayHasData = entriesForDay.length > 0 || hasObservationText || hasNews;
        if (!dayHasData) {
          return; 
        }

        if (contentAddedForPreviousDay) { 
          csvContent += `\n`; 
        }
        if (exportStartDate.getTime() !== exportEndDate.getTime()) {
            csvContent += `"${formattedDay}"\n`; 
        }
        contentAddedForPreviousDay = true;

        if (hasObservationText) {
            csvContent += `"Observaciones:",${obsText}\n`; 
        }

        if (hasNews) {
            csvContent += `"Novedades:"\n`;
            newsForDay.forEach(news => {
                const newsTime = news.created_at && isValidDate(parseISO(news.created_at)) ? format(parseISO(news.created_at), 'HH:mm', { locale: es }) : 'Hora desc.';
                csvContent += `"${newsTime} - ${news.pilot_full_name.replace(/"/g, '""')}: ${news.news_text.trim().replace(/"/g, '""')}"\n`;
            });
        }
        
        const remolcadorCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_REMOLCADOR_FOR_GROUPING);
        const instructorAvionCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_INSTRUCTOR_AVION_FOR_GROUPING);
        const instructorPlaneadorCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_INSTRUCTOR_PLANEADOR_FOR_GROUPING);

        const isRemolcadorConfirmedForDay = remolcadorCategoryDefinition 
          ? entriesForDay.some(entry => entry.pilot_category_id === remolcadorCategoryDefinition.id && entry.is_tow_pilot_available === true) 
          : true; 
        const isInstructorAvionConfirmedForDay = instructorAvionCategoryDefinition 
          ? entriesForDay.some(entry => entry.pilot_category_id === instructorAvionCategoryDefinition.id) 
          : true;
        const isInstructorPlaneadorConfirmedForDay = instructorPlaneadorCategoryDefinition 
          ? entriesForDay.some(entry => entry.pilot_category_id === instructorPlaneadorCategoryDefinition.id) 
          : true; 
        
        let warningsText = "";
        if (remolcadorCategoryDefinition && !isRemolcadorConfirmedForDay) {
          warningsText += `"Aviso: Aún no hay REMOLCADOR confirmado para esta fecha."\n`;
        }
        if (instructorAvionCategoryDefinition && !isInstructorAvionConfirmedForDay) {
            warningsText += `"Aviso: Aún no hay Instructor de Avión confirmado para esta fecha."\n`;
        }
        if (instructorPlaneadorCategoryDefinition && !isInstructorPlaneadorConfirmedForDay) {
            warningsText += `"Aviso: Aún no hay Instructor de Planeador confirmado para esta fecha."\n`;
        }

        if (warningsText) {
          csvContent += warningsText;
        }

        if (entriesForDay.length > 0) {
            csvContent += headers.join(",") + "\n";

            let previousGroupIdentifier: string | null = null;
            
            entriesForDay.forEach((entry) => {
              const groupDetails = getEntryGroupDetails(entry, categories);
              if (groupDetails.id !== previousGroupIdentifier) {
                csvContent += `"${groupDetails.name.replace(/"/g, '""')}",,,,,,\n`; 
                previousGroupIdentifier = groupDetails.id;
              }
              const formatted = getFormattedEntry(entry, data.allPilots, entriesForDay);
              
              let flightTypeCellContent = formatted.flightType;
              if (formatted.shouldFlightTypeBeBoldForInstructorOrTow || formatted.isSportFlight) {
                  flightTypeCellContent = `${formatted.flightType}`; 
              }

              const row = [
                formatted.time,
                `"${formatted.pilot.replace(/"/g, '""')}"`,
                `"${formatted.medicalWarningText.replace(/"/g, '""')}"`,
                `"${formatted.category.replace(/"/g, '""')}"`,
                formatted.availableStatus,
                `"${flightTypeCellContent.replace(/"/g, '""')}"`,
                `"${formatted.aircraft.replace(/"/g, '""')}"`,
                `"${formatted.sportConflictMessage.replace(/"/g, '""')}"`
              ];
              csvContent += row.join(",") + "\n";
            });
        } else if (hasObservationText || hasNews) { 
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
  
  const addPdfWarning = (doc: any, text: string, currentY: number, isBold: boolean = false): number => {
    let newY = currentY;
    if (newY > doc.internal.pageSize.getHeight() - 15) { 
        doc.addPage(); newY = 20; 
    }
    doc.setFontSize(9);
    doc.setTextColor(150, 0, 0); 
    doc.setFont(undefined, isBold ? 'bold' : 'normal');
    doc.text(text, 14, newY);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    return newY + 5;
  };


  const handleExportPdf = async () => {
    const data = await fetchDataForRange();
    if (!data || !exportStartDate || !exportEndDate) return;

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageTitle = `Agenda de Vuelo: ${format(exportStartDate, "PPP", { locale: es })}${exportStartDate.getTime() !== exportEndDate.getTime() ? ' - ' + format(exportEndDate, "PPP", { locale: es }) : ''}`;
    let currentY = 15;

    doc.setFontSize(16);
    doc.text(pageTitle, 14, currentY);
    currentY += 10;

    const dateInterval = eachDayOfInterval({ start: exportStartDate, end: exportEndDate });
    
    dateInterval.forEach((day, dayIndex) => {
        const dayStr = format(day, "yyyy-MM-dd"); 
        const entriesForDay = data.entries.filter(entry => entry.date === dayStr);
        const observationForDay = data.observations.find(obs => obs.date === dayStr);
        const newsForDay = data.newsItems.filter(news => news.date === dayStr);
        const hasObservationText = observationForDay && observationForDay.observation_text && observationForDay.observation_text.trim() !== '';
        const hasNews = newsForDay.length > 0;
        
        const dayHasData = entriesForDay.length > 0 || hasObservationText || hasNews;
        if (!dayHasData) {
          return; 
        }

        if (dayIndex > 0 && currentY > 20) { 
            doc.addPage();
            currentY = 15;
        } else if (dayIndex > 0) { 
            currentY = 15;
        }


        if (exportStartDate.getTime() !== exportEndDate.getTime()) {
            doc.setFontSize(14);
            doc.text(`Fecha: ${format(day, "PPP", { locale: es })}`, 14, currentY);
            currentY += 7;
        }


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
                     if (exportStartDate.getTime() !== exportEndDate.getTime()) {
                        doc.setFontSize(14); doc.text(`Fecha: ${format(day, "PPP", { locale: es })} (cont.)`, 14, currentY); currentY +=7;
                    }
                    doc.setFontSize(10); doc.text("Observaciones (cont.):", 14, currentY); currentY += 5;
                }
                doc.text(line, 14, currentY);
                currentY += 5;
            });
            currentY += 3; 
        }

        if (hasNews) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0,0,0);
            if (currentY > doc.internal.pageSize.getHeight() - 25) { 
                doc.addPage(); currentY = 15;
                 if (exportStartDate.getTime() !== exportEndDate.getTime()) {
                    doc.setFontSize(14); doc.text(`Fecha: ${format(day, "PPP", { locale: es })} (cont.)`, 14, currentY); currentY +=7;
                 }
            }
            doc.text("Novedades del Día:", 14, currentY);
            currentY += 6;
            doc.setFont('helvetica', 'normal');
            newsForDay.forEach(news => {
                const newsTime = news.created_at && isValidDate(parseISO(news.created_at)) ? format(parseISO(news.created_at), 'HH:mm', { locale: es }) : 'Hora desc.';
                const newsLine = `[${newsTime}] - ${news.pilot_full_name}: ${news.news_text.trim()}`;
                const splitNewsLines = doc.splitTextToSize(newsLine, doc.internal.pageSize.getWidth() - 28);
                splitNewsLines.forEach((line: string) => {
                    if (currentY > doc.internal.pageSize.getHeight() - 15) {
                         doc.addPage(); currentY = 15;
                         if (exportStartDate.getTime() !== exportEndDate.getTime()) {
                            doc.setFontSize(14); doc.text(`Fecha: ${format(day, "PPP", { locale: es })} (cont.)`, 14, currentY); currentY +=7;
                         }
                         doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text("Novedades del Día (cont.):", 14, currentY); currentY += 6;
                         doc.setFont('helvetica', 'normal');
                    }
                    doc.text(line, 14, currentY);
                    currentY += 5;
                });
            });
            currentY += 3;
        }
        
        const remolcadorCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_REMOLCADOR_FOR_GROUPING);
        const instructorAvionCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_INSTRUCTOR_AVION_FOR_GROUPING);
        const instructorPlaneadorCategoryDefinition = categories.find(cat => normalizeCategoryNameForGrouping(cat.name) === NORMALIZED_INSTRUCTOR_PLANEADOR_FOR_GROUPING);
        
        const isRemolcadorConfirmedForDay = remolcadorCategoryDefinition 
          ? entriesForDay.some(entry => entry.pilot_category_id === remolcadorCategoryDefinition.id && entry.is_tow_pilot_available === true) 
          : true; 
        const isInstructorAvionConfirmedForDay = instructorAvionCategoryDefinition 
          ? entriesForDay.some(entry => entry.pilot_category_id === instructorAvionCategoryDefinition.id) 
          : true; 
        const isInstructorPlaneadorConfirmedForDay = instructorPlaneadorCategoryDefinition 
          ? entriesForDay.some(entry => entry.pilot_category_id === instructorPlaneadorCategoryDefinition.id) 
          : true; 
        
        if (remolcadorCategoryDefinition && !isRemolcadorConfirmedForDay) {
            currentY = addPdfWarning(doc, 'Aviso: Aún no hay REMOLCADOR confirmado para esta fecha.', currentY, true);
        }
        if (instructorAvionCategoryDefinition && !isInstructorAvionConfirmedForDay) {
           currentY = addPdfWarning(doc, 'Aviso: Aún no hay Instructor de Avión confirmado para esta fecha.', currentY);
        }
        if (instructorPlaneadorCategoryDefinition && !isInstructorPlaneadorConfirmedForDay) {
           currentY = addPdfWarning(doc, 'Aviso: Aún no hay Instructor de Planeador confirmado para esta fecha.', currentY);
        }

        doc.setTextColor(0, 0, 0); 
        if ( (remolcadorCategoryDefinition && !isRemolcadorConfirmedForDay) ||
             (instructorAvionCategoryDefinition && !isInstructorAvionConfirmedForDay) ||
             (instructorPlaneadorCategoryDefinition && !isInstructorPlaneadorConfirmedForDay)
           ) {
            currentY +=2; 
        }

        if (entriesForDay.length === 0 && (hasObservationText || hasNews)) {
            doc.setFontSize(10);
            if (currentY > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); currentY = 15; }
            doc.text("No hay turnos programados para esta fecha.", 14, currentY);
            currentY += 10;
        } else if (entriesForDay.length > 0) {
            const tableColumn = ["Hora", "Piloto", "Adv. Psicof.", "Categoría (Turno)", "Disponible", "Tipo Vuelo", "Aeronave", "Adv. V.D."];
            const tableRows: (string | { content: string; colSpan?: number; styles?: any } | null)[][] = [];
            
            let previousGroupIdentifier: string | null = null;
            
            entriesForDay.forEach(entry => {
              const groupDetails = getEntryGroupDetails(entry, categories);
              let groupHeaderStyle: any = { fontStyle: 'bold', fillColor: [220, 230, 240], textColor: [10, 40, 70] }; 
                
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
              const formatted = getFormattedEntry(entry, data.allPilots, entriesForDay);
              
              const flightTypeCellStyles: any = {};
              if (formatted.shouldFlightTypeBeBoldForInstructorOrTow || formatted.isSportFlight) {
                  flightTypeCellStyles.fontStyle = 'bold';
              }
              const flightTypeCell = { content: formatted.flightType, styles: flightTypeCellStyles };
                
              const medicalCellStyles: any = {};
              if (formatted.medicalWarningSeverity === 'critical') {
                  medicalCellStyles.textColor = [200, 0, 0]; 
              } else if (formatted.medicalWarningSeverity === 'warning') {
                  medicalCellStyles.textColor = [200, 100, 0]; 
              }
              const medicalCell = { content: formatted.medicalWarningText, styles: medicalCellStyles };

              const sportConflictCell = { content: formatted.sportConflictMessage, styles: { textColor: [230, 126, 34], fontSize: 7 } };

              tableRows.push([
                  formatted.time,
                  formatted.pilot,
                  medicalCell,
                  formatted.category,
                  formatted.availableStatus,
                  flightTypeCell,
                  formatted.aircraft,
                  sportConflictCell
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
                    0: { cellWidth: 15 }, 
                    1: { cellWidth: 'auto' }, 
                    2: { cellWidth: 30 }, 
                    3: { cellWidth: 28 }, 
                    4: { cellWidth: 20 }, 
                    5: { cellWidth: 25 }, 
                    6: { cellWidth: 'auto' },
                    7: { cellWidth: 35 }, 
                },
                didDrawPage: (hookData) => { 
                    currentY = hookData.cursor?.y ?? currentY;
                    if (hookData.pageNumber > 1 && hookData.settings.startY !== 15) { 
                        currentY = 15; 
                    }
                },
                willDrawPage: (hookData) => {
                     if (hookData.pageNumber > 1) currentY = 15; 
                },
                didParseCell: function (hookData) {
                    if (hookData.row.raw && typeof hookData.row.raw[0] === 'object' && (hookData.row.raw[0] as any)?.colSpan) {
                        const cellObject = hookData.row.raw[0] as { content: string; styles: any; colSpan?: number };
                        if (cellObject.styles) Object.assign(hookData.cell.styles, cellObject.styles);
                        if (cellObject.colSpan) hookData.cell.colSpan = cellObject.colSpan;
                    } 
                    else if (hookData.cell.raw && typeof hookData.cell.raw === 'object' && hookData.cell.raw !== null && 'styles' in hookData.cell.raw) {
                        const cellObject = hookData.cell.raw as { content: string; styles: any };
                         if (cellObject.styles) Object.assign(hookData.cell.styles, cellObject.styles);
                        hookData.cell.text = cellObject.content; 
                    }
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10; 
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
