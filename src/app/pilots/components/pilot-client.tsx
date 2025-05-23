
"use client";

import React from 'react';
import { useState, useCallback } from 'react';
import type { Pilot } from '@/types'; // PilotCategory removed as it's not directly used here after removing admin badge.
import { usePilotsStore, usePilotCategoriesStore } from '@/store/data-hooks';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'; // ShieldCheck removed
import { PilotForm } from './pilot-form';
import { PageHeader } from '@/components/common/page-header';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { PilotReportButton } from './pilot-report-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
// UnderlineKeywords removed as it's not used after admin badge removal

export function PilotClient() {
  const { pilots, addPilot, updatePilot, deletePilot: removePilot, loading, error, fetchPilots } = usePilotsStore();
  const { categories: pilotCategories, getCategoryName, loading: categoriesLoading, error: categoriesError, fetchCategories } = usePilotCategoriesStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPilot, setEditingPilot] = useState<Pilot | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pilotToDelete, setPilotToDelete] = useState<Pilot | null>(null);

  const handleAddPilot = () => {
    setEditingPilot(undefined);
    setIsFormOpen(true);
  };

  const handleEditPilot = (pilot: Pilot) => {
    setEditingPilot(pilot);
    setIsFormOpen(true);
  };

  const handleDeletePilot = (pilot: Pilot) => {
    setPilotToDelete(pilot);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (pilotToDelete) {
      await removePilot(pilotToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setPilotToDelete(null);
  };

  const handleSubmitForm = async (data: Omit<Pilot, 'id' | 'created_at' | 'is_admin'>, pilotId?: string) => { // is_admin removed
    if (pilotId) {
      await updatePilot({ ...data, id: pilotId } as Pilot); // Ensure type compatibility, is_admin won't be in data
    } else {
      await addPilot(data);
    }
    setIsFormOpen(false);
  };

  const handleRefreshAll = useCallback(() => {
    fetchPilots();
    fetchCategories();
  }, [fetchPilots, fetchCategories]);

  React.useEffect(() => {
    handleRefreshAll();
  }, [handleRefreshAll]);


  const combinedLoading = loading || categoriesLoading;
  const combinedError = error || categoriesError;

  if (combinedError) {
    return (
      <div className="text-destructive p-4">
        Error al cargar datos: {combinedError.message || JSON.stringify(combinedError)}
        <Button onClick={handleRefreshAll} className="ml-2 mt-2">Reintentar Cargar Todo</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Pilotos"
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRefreshAll} variant="outline" size="icon" disabled={combinedLoading}>
              <RefreshCw className={cn("h-4 w-4", combinedLoading && "animate-spin")} />
               <span className="sr-only">Refrescar datos</span>
            </Button>
            <PilotReportButton
              pilots={pilots}
              getCategoryName={getCategoryName}
              disabled={combinedLoading || pilots.length === 0}
            />
            <Button onClick={handleAddPilot} disabled={combinedLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Piloto
            </Button>
          </div>
        }
      />

      {combinedLoading && !pilots.length ? (
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
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Categorías</TableHead>
                <TableHead>Venc. Psicofísico</TableHead>
                {/* Admin column removed */}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pilots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24"> {/* ColSpan reduced */}
                    No hay pilotos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                pilots.map((pilot) => {
                  let medicalExpiryDisplay: React.ReactNode = 'N/A';
                  if (pilot.medical_expiry) {
                    const medicalExpiryDate = parseISO(pilot.medical_expiry);
                    const todayNormalized = startOfDay(new Date());

                    if (isValid(medicalExpiryDate)) {
                      const formattedDate = format(medicalExpiryDate, "dd/MM/yyyy", { locale: es });
                      const isExpired = isBefore(medicalExpiryDate, todayNormalized);
                      const daysUntilExpiryFromToday = differenceInDays(medicalExpiryDate, todayNormalized);

                      if (isExpired) {
                        medicalExpiryDisplay = (
                          <span className="text-destructive font-bold">
                            VENCIDO {formattedDate}
                          </span>
                        );
                      } else if (daysUntilExpiryFromToday <= 30) {
                        medicalExpiryDisplay = (
                          <span className="flex items-center">
                            {formattedDate}
                            <Badge variant="destructive" className="ml-2 text-xs shrink-0">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Vence en {daysUntilExpiryFromToday} día(s)
                            </Badge>
                          </span>
                        );
                      } else if (daysUntilExpiryFromToday <= 60) {
                        medicalExpiryDisplay = (
                          <span className="flex items-center">
                            {formattedDate}
                            <Badge className="ml-2 text-xs shrink-0 bg-yellow-400 text-black hover:bg-yellow-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Vence en {daysUntilExpiryFromToday} día(s)
                            </Badge>
                          </span>
                        );
                      } else {
                        medicalExpiryDisplay = formattedDate;
                      }
                    }
                  }

                  return (
                    <TableRow key={pilot.id}>
                      <TableCell>{pilot.first_name}</TableCell>
                      <TableCell>{pilot.last_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pilot.category_ids.map(catId => (
                            <Badge key={catId} variant="secondary">
                              {getCategoryName(catId)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {medicalExpiryDisplay}
                      </TableCell>
                      {/* Admin cell removed */}
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditPilot(pilot)} className="mr-2 hover:text-primary">
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePilot(pilot)} className="hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PilotForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        pilot={editingPilot}
        categories={pilotCategories}
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={pilotToDelete ? `${pilotToDelete.first_name} ${pilotToDelete.last_name}` : 'este piloto'}
      />
    </>
  );
}
