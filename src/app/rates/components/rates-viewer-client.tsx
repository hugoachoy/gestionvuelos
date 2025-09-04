
"use client";

import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Rate } from '@/types';
import { useRatesStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';

export function RatesViewerClient() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { rates, loading, error, fetchRates } = useRatesStore();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const lastUpdatedDate = useMemo(() => {
    if (!rates || rates.length === 0) {
      return null;
    }
    const mostRecentDate = rates.reduce((latest, current) => {
      if (!current.created_at) return latest;
      const currentDate = parseISO(current.created_at);
      if (!isValid(currentDate)) return latest;

      if (!latest || currentDate > latest) {
        return currentDate;
      }
      return latest;
    }, null as Date | null);

    return mostRecentDate ? format(mostRecentDate, "dd/MM/yyyy") : null;
  }, [rates]);

  const formatValue = (value: number | null | undefined, isPercentage: boolean | null | undefined) => {
    if (value === null || value === undefined) return '-';
    if (isPercentage) {
      return `${value}%`;
    }
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const handleExportPdf = async () => {
    if (rates.length === 0) {
      toast({ title: "Sin Datos", description: "No hay tarifas para exportar." });
      return;
    }
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      const generationDate = format(new Date(), "dd/MM/yyyy HH:mm");

      doc.setFontSize(18);
      doc.text("Listado de Tarifas", 14, 22);
      doc.setFontSize(10);
      doc.text(`Generado el: ${generationDate}`, 14, 28);
      if(lastUpdatedDate) {
        doc.text(`Tarifas vigentes desde: ${lastUpdatedDate}`, 14, 34);
      }
      
      const tableColumn = ["Ítem", "Precio Socio", "Precio No Socio", "POS Socio", "POS No Socio"];
      const tableRows = rates.map(rate => [
        rate.item_name,
        formatValue(rate.is_percentage ? rate.percentage_value : rate.member_price, rate.is_percentage),
        formatValue(rate.is_percentage ? rate.percentage_value : rate.non_member_price, rate.is_percentage),
        formatValue(rate.pos_member_price, false),
        formatValue(rate.pos_non_member_price, false)
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontStyle: 'bold' },
      });

      doc.save(`tarifas_aeroclub_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF Exportado", description: "El listado de tarifas se ha guardado correctamente." });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error de Exportación", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoadingUI = loading || authLoading || isExporting;

  if (error) {
    return <div className="text-destructive">Error al cargar tarifas: {error.message}</div>;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <div>
           {lastUpdatedDate && (
              <p className="text-sm text-muted-foreground">Tarifas vigentes desde el {lastUpdatedDate}</p>
            )}
        </div>
        <div className="flex gap-2 flex-wrap">
            <Button onClick={handleExportPdf} variant="outline" disabled={isLoadingUI || rates.length === 0}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar a PDF
            </Button>
        </div>
      </div>
      
      {isLoadingUI && !rates.length ? (
         <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ítem</TableHead>
                <TableHead className="text-right">Precio Socio</TableHead>
                <TableHead className="text-right">Precio No Socio</TableHead>
                <TableHead className="text-right">POS Socio</TableHead>
                <TableHead className="text-right">POS No Socio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No hay tarifas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.item_name}</TableCell>
                    <TableCell className="text-right">{formatValue(rate.is_percentage ? rate.percentage_value : rate.member_price, rate.is_percentage)}</TableCell>
                    <TableCell className="text-right">{formatValue(rate.is_percentage ? rate.percentage_value : rate.non_member_price, rate.is_percentage)}</TableCell>
                    <TableCell className="text-right">{formatValue(rate.pos_member_price, false)}</TableCell>
                    <TableCell className="text-right">{formatValue(rate.pos_non_member_price, false)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
