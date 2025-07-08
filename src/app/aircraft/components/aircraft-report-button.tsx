
"use client";

import React, { useState } from 'react';
import type { Aircraft } from '@/types';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface AircraftReportButtonProps {
  aircraft: Aircraft[];
  disabled?: boolean;
}

export function AircraftReportButton({ aircraft, disabled }: AircraftReportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const generateAircraftReportPdf = async () => {
    if (!aircraft.length) {
      toast({ title: "Sin Datos", description: "No hay aeronaves para exportar.", variant: "default" });
      return;
    }
    setIsExporting(true);

    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait' });
      const pageTitle = "Informe de Aeronaves y Vencimientos";
      let currentY = 15;

      doc.setFontSize(16);
      doc.text(pageTitle, 14, currentY);
      currentY += 10;

      const aircraftTypeTranslations: Record<Aircraft['type'], string> = {
        'Tow Plane': 'Avión Remolcador',
        'Glider': 'Planeador',
        'Avión': 'Avión',
      };
      
      const aircraftTypeOrder: Record<Aircraft['type'], number> = {
        'Tow Plane': 1,
        'Glider': 2,
        'Avión': 3,
      };

      const sortedAircraft = [...aircraft].sort((a, b) => {
        const typeOrderA = aircraftTypeOrder[a.type];
        const typeOrderB = aircraftTypeOrder[b.type];
  
        if (typeOrderA !== typeOrderB) {
          return typeOrderA - typeOrderB;
        }
        return a.name.localeCompare(b.name);
      });

      const tableColumn = ["Nombre/Matrícula", "Tipo", "Venc. Anual", "Venc. Seguro"];
      const tableRows: (string | { content: string; styles?: any })[][] = [];

      sortedAircraft.forEach(ac => {
        let annualReviewDisplay = 'N/A';
        if (ac.annual_review_date && isValid(parseISO(ac.annual_review_date))) {
          annualReviewDisplay = format(parseISO(ac.annual_review_date), "dd/MM/yyyy", { locale: es });
        }
        
        let insuranceExpiryDisplay = 'N/A';
        if (ac.insurance_expiry_date && isValid(parseISO(ac.insurance_expiry_date))) {
          insuranceExpiryDisplay = format(parseISO(ac.insurance_expiry_date), "dd/MM/yyyy", { locale: es });
        }
        
        tableRows.push([
          ac.name,
          aircraftTypeTranslations[ac.type] || ac.type,
          annualReviewDisplay,
          insuranceExpiryDisplay,
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
        },
      });

      doc.save(`informe_aeronaves_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF Exportado", description: "El informe de aeronaves se ha exportado a PDF." });

    } catch (error) {
      console.error("Error generating aircraft report PDF:", error);
      toast({ title: "Error de Exportación", description: "No se pudo generar el PDF de aeronaves.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={generateAircraftReportPdf} disabled={isExporting || disabled}>
      {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      Exportar Informe
    </Button>
  );
}
