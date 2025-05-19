
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
import type { ScheduleEntry } from "@/types";
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { FLIGHT_TYPES } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ShareButtonProps {
  scheduleDate: Date;
  entries: ScheduleEntry[];
}

// Extend jsPDF with autoTable - this is a common way to type it for TypeScript
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export function ShareButton({ scheduleDate, entries }: ShareButtonProps) {
  const { toast } = useToast();
  const { getPilotName } = usePilotsStore(); 
  const { getCategoryName } = usePilotCategoriesStore();
  const { getAircraftName } = useAircraftStore();

  const getFormattedEntries = () => {
    return entries.map(entry => {
      const pilotName = getPilotName(entry.pilotId);
      const categoryName = getCategoryName(entry.pilotCategoryId);
      const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flightTypeId)?.name || 'N/A';
      const aircraftText = entry.aircraftId ? getAircraftName(entry.aircraftId) : 'N/A';
      let towPilotStatus = '';
      if (categoryName === 'Piloto remolcador') {
        towPilotStatus = entry.isTowPilotAvailable ? 'Sí' : 'No';
      }
      return {
        time: entry.startTime,
        pilot: pilotName,
        category: categoryName,
        towAvailable: towPilotStatus,
        flightType: flightTypeName,
        aircraft: aircraftText,
        rawEntry: entry // keep raw entry for other uses if needed
      };
    });
  };

  const generateShareText = () => {
    let text = `Agenda de Vuelo - ${format(scheduleDate, "PPP", { locale: es })}\n\n`;
    if (entries.length === 0) {
      text += "No hay turnos programados para esta fecha.";
    } else {
      const formattedEntries = getFormattedEntries();
      formattedEntries.forEach(entry => {
        text += `${entry.time} - ${entry.pilot} (${entry.category}${entry.towAvailable ? ' - Rem: ' + entry.towAvailable : ''}) - ${entry.flightType}${entry.aircraft !== 'N/A' ? ' - Aeronave: ' + entry.aircraft : ''}\n`;
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
    const formattedEntries = getFormattedEntries();
    const headers = ["Hora", "Piloto", "Categoría", "Remolcador Disponible", "Tipo de Vuelo", "Aeronave"];
    let csvContent = headers.join(",") + "\n";

    formattedEntries.forEach(entry => {
      const row = [
        entry.time,
        `"${entry.pilot.replace(/"/g, '""')}"`, // Handle potential commas/quotes in names
        `"${entry.category.replace(/"/g, '""')}"`,
        entry.towAvailable,
        `"${entry.flightType.replace(/"/g, '""')}"`,
        `"${entry.aircraft.replace(/"/g, '""')}"`,
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    const formattedEntries = getFormattedEntries();
    
    doc.setFontSize(16);
    doc.text(`Agenda de Vuelo - ${format(scheduleDate, "PPP", { locale: es })}`, 14, 15);
    doc.setFontSize(10);

    const tableColumn = ["Hora", "Piloto", "Categoría", "Rem. Disp.", "Tipo Vuelo", "Aeronave"];
    const tableRows: (string | null)[][] = [];

    formattedEntries.forEach(entry => {
      const rowData = [
        entry.time,
        entry.pilot,
        entry.category,
        entry.towAvailable || '-', // Show '-' if no status
        entry.flightType,
        entry.aircraft,
      ];
      tableRows.push(rowData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [22, 160, 133] }, // Example header color
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
        // Example: set specific column widths if needed
        // 0: { cellWidth: 20 }, 
        // 1: { cellWidth: 'auto' },
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

