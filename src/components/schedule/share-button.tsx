
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, FileSpreadsheet, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ScheduleEntry, PilotCategory } from "@/types";
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { FLIGHT_TYPES } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ShareButtonProps {
  scheduleDate: Date;
  entries: ScheduleEntry[]; // These are already sorted by the parent component
  observationText?: string;
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Helper to determine the primary group of an entry for separator logic
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

export function ShareButton({ scheduleDate, entries, observationText }: ShareButtonProps) {
  const { toast } = useToast();
  const { getPilotName } = usePilotsStore();
  const { categories, getCategoryName } = usePilotCategoriesStore();
  const { getAircraftName } = useAircraftStore();

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

  const generateShareText = () => {
    let text = `Agenda de Vuelo - ${format(scheduleDate, "PPP", { locale: es })}\n`;
    if (observationText) {
      text += `\nObservaciones:\n${observationText}\n`;
    }
    text += "\n";

    if (entries.length === 0) {
      text += "No hay turnos programados para esta fecha.";
    } else {
      let previousGroupIdentifier: string | null = null;
      entries.forEach(entry => {
        const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
        if (groupDetails.id !== previousGroupIdentifier) {
          text += `\n--- ${groupDetails.name} ---\n`;
          previousGroupIdentifier = groupDetails.id;
        }
        const formatted = getFormattedEntry(entry);
        text += `${formatted.time} - ${formatted.pilot} (${formatted.category}${formatted.towAvailable ? ' - Rem: ' + formatted.towAvailable : ''}) - ${formatted.flightType}${formatted.aircraft !== 'N/A' ? ' - Aeronave: ' + formatted.aircraft : ''}\n`;
      });
    }
    return text;
  };

  const handleShareText = async () => {
    const shareText = generateShareText();
    const shareData = {
      title: `Agenda de Vuelo - ${format(scheduleDate, "PPP", { locale: es })}`,
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

  const handleExportCsv = () => {
    let csvContent = `Fecha: ${format(scheduleDate, "yyyy-MM-dd", { locale: es })}\n`;
    if (observationText) {
      const escapedObservationText = observationText.replace(/"/g, '""');
      csvContent += `Observaciones: "${escapedObservationText}"\n`;
    }
    csvContent += "\n";

    const headers = ["Hora", "Piloto", "Categoría", "Remolcador Disponible", "Tipo de Vuelo", "Aeronave"];
    csvContent += headers.join(",") + "\n";

    if (entries.length === 0) {
      csvContent += "No hay turnos programados,,,,,\n";
    } else {
      let previousGroupIdentifier: string | null = null;
      entries.forEach(entry => {
        const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
        if (groupDetails.id !== previousGroupIdentifier) {
          csvContent += `"${groupDetails.name}",,,,,\n`; // Group name in first column
          previousGroupIdentifier = groupDetails.id;
        }
        const formatted = getFormattedEntry(entry);
        const row = [
          formatted.time,
          `"${formatted.pilot.replace(/"/g, '""')}"`,
          `"${formatted.category.replace(/"/g, '""')}"`,
          formatted.towAvailable,
          `"${formatted.flightType.replace(/"/g, '""')}"`,
          `"${formatted.aircraft.replace(/"/g, '""')}"`,
        ];
        csvContent += row.join(",") + "\n";
      });
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `agenda_${format(scheduleDate, "yyyy-MM-dd")}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "CSV Exportado", description: "La agenda se ha exportado a CSV." });
    } else {
      toast({ title: "Error de Exportación", description: "Tu navegador no soporta la descarga de archivos.", variant: "destructive"});
    }
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageTitle = `Agenda de Vuelo - ${format(scheduleDate, "PPP", { locale: es })}`;
    let currentY = 15;

    doc.setFontSize(16);
    doc.text(pageTitle, 14, currentY);
    currentY += 10;

    if (observationText) {
      doc.setFontSize(10);
      const observationLines = doc.splitTextToSize(observationText, doc.internal.pageSize.getWidth() - 28);
      doc.text("Observaciones:", 14, currentY);
      currentY += 5;
      observationLines.forEach((line: string) => {
        if (currentY > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            currentY = 15;
        }
        doc.text(line, 14, currentY);
        currentY += 5;
      });
      currentY += 5;
    }

    const tableColumn = ["Hora", "Piloto", "Categoría", "Rem. Disp.", "Tipo Vuelo", "Aeronave"];
    const tableRows: (string | { content: string; colSpan: number; styles: any } | null)[][] = [];

    if (entries.length === 0) {
      tableRows.push([{ content: "No hay turnos programados para esta fecha.", colSpan: tableColumn.length, styles: { halign: 'center' } }]);
    } else {
      let previousGroupIdentifier: string | null = null;
      entries.forEach(entry => {
        const groupDetails = getEntryGroupDetails(entry, categories, getCategoryName, getAircraftName);
        if (groupDetails.id !== previousGroupIdentifier) {
          tableRows.push([
            {
              content: groupDetails.name,
              colSpan: tableColumn.length,
              styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: 0, halign: 'left' },
            },
          ]);
          previousGroupIdentifier = groupDetails.id;
        }
        const formatted = getFormattedEntry(entry);
        const rowData = [
          formatted.time,
          formatted.pilot,
          formatted.category,
          formatted.towAvailable || '-',
          formatted.flightType,
          formatted.aircraft,
        ];
        tableRows.push(rowData);
      });
    }
    
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [22, 160, 133], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
         0: { cellWidth: 20 },
         1: { cellWidth: 'auto' },
         2: { cellWidth: 35 },
         3: { cellWidth: 25 },
         4: { cellWidth: 30 },
         5: { cellWidth: 'auto' },
      },
      didParseCell: function (data) {
        // Custom styling for separator rows
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

    doc.save(`agenda_${format(scheduleDate, "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF Exportado", description: "La agenda se ha exportado a PDF." });
  };


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Compartir/Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Opciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShareText}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>Compartir texto</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCsv}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Exportar a CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPdf}>
          <FileText className="mr-2 h-4 w-4" />
          <span>Exportar a PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

    