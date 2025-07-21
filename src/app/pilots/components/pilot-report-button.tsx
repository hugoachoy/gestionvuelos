
"use client";

import React, { useState } from 'react';
import type { Pilot } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface PilotReportButtonProps {
  pilots: Pilot[];
  getCategoryName: (categoryId: string) => string;
  disabled?: boolean;
}

export function PilotReportButton({ pilots, getCategoryName, disabled }: PilotReportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const generateTotalPilotsPdf = async () => {
    if (!pilots.length) {
      toast({ title: "Sin Datos", description: "No hay pilotos para exportar.", variant: "default" });
      return;
    }
    setIsExporting(true);

    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait' });
      const pageTitle = "Listado Total de Pilotos";
      let currentY = 15;

      doc.setFontSize(16);
      doc.text(pageTitle, 14, currentY);
      currentY += 10;

      const sortedPilots = [...pilots].sort((a, b) => {
        const lastNameComp = a.last_name.localeCompare(b.last_name);
        if (lastNameComp !== 0) return lastNameComp;
        return a.first_name.localeCompare(b.first_name);
      });

      const tableColumn = ["Apellido", "Nombre", "Categorías", "Venc. Psicofísico"];
      const tableRows: (string | { content: string; styles?: any })[][] = [];

      sortedPilots.forEach(pilot => {
        const categoriesText = pilot.category_ids.map(catId => getCategoryName(catId)).join(', ');
        let medicalExpiryDisplay = 'N/A';
        if (pilot.medical_expiry) {
          const medicalExpiryDate = parseISO(pilot.medical_expiry);
          if (isValid(medicalExpiryDate)) {
            medicalExpiryDisplay = format(medicalExpiryDate, "dd/MM/yyyy", { locale: es });
          }
        }
        tableRows.push([
          pilot.last_name,
          pilot.first_name,
          categoriesText,
          medicalExpiryDisplay,
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 1.5, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 35 },
        },
      });

      doc.save(`listado_total_pilotos_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF Exportado", description: "El listado total de pilotos se ha exportado a PDF." });

    } catch (error) {
      console.error("Error generating total pilots PDF:", error);
      toast({ title: "Error de Exportación", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const generateUpcomingExpiriesPdf = async () => {
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const todayNormalized = startOfDay(new Date());
      const sixtyDaysFromToday = new Date(todayNormalized);
      sixtyDaysFromToday.setDate(todayNormalized.getDate() + 60);

      const relevantPilots = pilots.filter(pilot => {
        if (!pilot.medical_expiry) return false;
        const medicalExpiryDate = parseISO(pilot.medical_expiry);
        if (!isValid(medicalExpiryDate)) return false;
        return isBefore(medicalExpiryDate, sixtyDaysFromToday); // Expired or expiring within 60 days
      }).sort((a, b) => {
        const dateA = a.medical_expiry ? parseISO(a.medical_expiry) : new Date(0); // Handle nulls for sorting
        const dateB = b.medical_expiry ? parseISO(b.medical_expiry) : new Date(0);
        const dateComp = dateA.getTime() - dateB.getTime();
        if (dateComp !== 0) return dateComp;
        const lastNameComp = a.last_name.localeCompare(b.last_name);
        if (lastNameComp !== 0) return lastNameComp;
        return a.first_name.localeCompare(b.first_name);
      });

      if (!relevantPilots.length) {
        toast({ title: "Sin Datos", description: "No hay pilotos con vencimientos próximos o vencidos.", variant: "default" });
        setIsExporting(false);
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait' });
      const pageTitle = "Informe de Vencimientos de Psicofísico";
      let currentY = 15;

      doc.setFontSize(16);
      doc.text(pageTitle, 14, currentY);
      currentY += 10;

      const tableColumn = ["Apellido", "Nombre", "Venc. Psicofísico", "Estado"];
      const tableRows: (string | { content: string; styles?: any })[][] = [];

      relevantPilots.forEach(pilot => {
        const medicalExpiryDate = parseISO(pilot.medical_expiry!); // Already checked for validity
        const formattedDate = format(medicalExpiryDate, "dd/MM/yyyy", { locale: es });
        let statusText = "";
        let statusStyles: any = {};

        const daysUntilExpiry = differenceInDays(medicalExpiryDate, todayNormalized);

        if (isBefore(medicalExpiryDate, todayNormalized)) {
          statusText = "VENCIDO";
          statusStyles = { textColor: [255, 0, 0], fontStyle: 'bold' }; // Red
        } else if (daysUntilExpiry <= 30) {
          statusText = `Vence en ${daysUntilExpiry} día(s)`;
           statusStyles = { textColor: [255, 0, 0] }; // Red
        } else if (daysUntilExpiry <= 60) {
          statusText = `Vence en ${daysUntilExpiry} día(s)`;
          statusStyles = { textColor: [230, 126, 34] }; // Dark Yellow/Orange
        } else {
           statusText = `Vence en ${daysUntilExpiry} día(s)`; // Should not happen due to filter, but good fallback
        }

        tableRows.push([
          pilot.last_name,
          pilot.first_name,
          formattedDate,
          { content: statusText, styles: statusStyles },
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 1.5, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 35 },
          3: { cellWidth: 40 },
        },
         didParseCell: function (data) {
          if (data.column.dataKey === 3 && typeof data.cell.raw === 'object' && data.cell.raw !== null && 'styles' in data.cell.raw) {
            Object.assign(data.cell.styles, (data.cell.raw as any).styles);
            data.cell.text = (data.cell.raw as any).content;
          }
        }
      });

      doc.save(`vencimientos_psicofisicos_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF Exportado", description: "El informe de vencimientos se ha exportado a PDF." });

    } catch (error) {
      console.error("Error generating upcoming expiries PDF:", error);
      toast({ title: "Error de Exportación", description: "No se pudo generar el PDF de vencimientos.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting || disabled}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar Informes
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Opciones de Exportación</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={generateTotalPilotsPdf} disabled={isExporting}>
          <FileText className="mr-2 h-4 w-4" />
          <span>Listado Total de Pilotos</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generateUpcomingExpiriesPdf} disabled={isExporting}>
          <FileText className="mr-2 h-4 w-4" />
          <span>Vencimientos Psicofísicos</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
