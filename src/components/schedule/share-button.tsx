
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
import type { ScheduleEntry } from "@/types"; // ScheduleEntry now has snake_case
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { FLIGHT_TYPES } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ShareButtonProps {
  scheduleDate: Date;
  entries: ScheduleEntry[];
  observationText?: string; // This is already string | undefined
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export function ShareButton({ scheduleDate, entries, observationText }: ShareButtonProps) {
  const { toast } = useToast();
  const { getPilotName } = usePilotsStore(); 
  const { getCategoryName } = usePilotCategoriesStore();
  const { getAircraftName } = useAircraftStore();

  const getFormattedEntries = () => {
    return entries.map(entry => {
      const pilotName = getPilotName(entry.pilot_id);
      const categoryName = getCategoryName(entry.pilot_category_id);
      const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flight_type_id)?.name || 'N/A';
      const aircraftText = entry.aircraft_id ? getAircraftName(entry.aircraft_id) : 'N/A';
      let towPilotStatus = '';
      if (categoryName === 'Piloto remolcador') {
        towPilotStatus = entry.is_tow_pilot_available ? 'Sí' : 'No';
      }
      return {
        time: entry.start_time, // snake_case
        pilot: pilotName,
        category: categoryName,
        towAvailable: towPilotStatus,
        flightType: flightTypeName,
        aircraft: aircraftText,
      };
    });
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
    let csvContent = `Fecha: ${format(scheduleDate, "yyyy-MM-dd", { locale: es })}\n`;
    if (observationText) {
      const escapedObservationText = observationText.replace(/"/g, '""');
      csvContent += `Observaciones: "${escapedObservationText}"\n`;
    }
    csvContent += "\n"; 

    const headers = ["Hora", "Piloto", "Categoría", "Remolcador Disponible", "Tipo de Vuelo", "Aeronave"];
    csvContent += headers.join(",") + "\n";

    formattedEntries.forEach(entry => {
      const row = [
        entry.time,
        `"${entry.pilot.replace(/"/g, '""')}"`, 
        `"${entry.category.replace(/"/g, '""')}"`,
        entry.towAvailable,
        `"${entry.flightType.replace(/"/g, '""')}"`,
        `"${entry.aircraft.replace(/"/g, '""')}"`,
      ];
      csvContent += row.join(",") + "\n";
    });

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
    const formattedEntries = getFormattedEntries();
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
    const tableRows: (string | null)[][] = [];

    formattedEntries.forEach(entry => {
      const rowData = [
        entry.time,
        entry.pilot,
        entry.category,
        entry.towAvailable || '-', 
        entry.flightType,
        entry.aircraft,
      ];
      tableRows.push(rowData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: currentY, 
      theme: 'grid',
      headStyles: { fillColor: [22, 160, 133] }, 
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
         0: { cellWidth: 20 }, 
         1: { cellWidth: 'auto' }, 
         2: { cellWidth: 35 }, 
         3: { cellWidth: 25 }, 
         4: { cellWidth: 30 }, 
         5: { cellWidth: 'auto' }, 
      },
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
