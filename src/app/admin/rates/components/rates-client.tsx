
"use client";

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { Rate } from '@/types';
import { useRatesStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, RefreshCw, Download, Loader2 } from 'lucide-react';
import { RateForm } from './rate-form';
import { DeleteDialog } from '@/components/common/delete-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export function RatesClient() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { rates, addRate, updateRate, deleteRate, loading, error, fetchRates } = useRatesStore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<Rate | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const handleAddRate = () => {
    setEditingRate(undefined);
    setIsFormOpen(true);
  };

  const handleEditRate = (rate: Rate) => {
    setEditingRate(rate);
    setIsFormOpen(true);
  };

  const handleDeleteRate = (rate: Rate) => {
    setRateToDelete(rate);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (rateToDelete) {
      const success = await deleteRate(rateToDelete.id);
      if (success) {
        toast({ title: "Tarifa Eliminada", description: `La tarifa "${rateToDelete.item_name}" ha sido eliminada.` });
      } else {
        toast({ title: "Error al Eliminar", description: "No se pudo eliminar la tarifa.", variant: "destructive" });
      }
    }
    setIsDeleteDialogOpen(false);
    setRateToDelete(null);
  };

  const handleSubmitForm = async (data: Omit<Rate, 'id' | 'created_at'>, rateId?: string) => {
    if (rateId) {
      await updateRate({ ...data, id: rateId });
    } else {
      await addRate(data);
    }
    setIsFormOpen(false);
  };
  
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
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
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

  if (!currentUser?.is_admin && !authLoading) {
    return (
       <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Acceso Denegado</AlertTitle>
            <AlertDescription>Esta sección está disponible solo para administradores.</AlertDescription>
        </Alert>
    );
  }

  if (error) {
    return <div className="text-destructive">Error al cargar tarifas: {error.message}</div>;
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <div className="flex gap-2">
            <Button onClick={() => fetchRates()} variant="outline" size="icon" disabled={isLoadingUI}>
              <RefreshCw className={cn("h-4 w-4", isLoadingUI && "animate-spin")} />
            </Button>
            <Button onClick={handleExportPdf} variant="outline" disabled={isLoadingUI || rates.length === 0}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar a PDF
            </Button>
            <Button onClick={handleAddRate} disabled={isLoadingUI}>
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Tarifa
            </Button>
        </div>
      </div>
      
      {isLoadingUI && !rates.length ? (
         <div className="space-y-2">
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
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
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
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditRate(rate)} className="mr-2 hover:text-primary">
                          <Edit className="h-4 w-4" />
                           <span className="sr-only">Editar</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRate(rate)} className="hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Eliminar</span>
                        </Button>
                      </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <RateForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        rate={editingRate}
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={rateToDelete?.item_name || 'esta tarifa'}
      />
    </>
  );
}
