
"use client";

import React from 'react';
import { useState, useCallback, useEffect } from 'react'; // useEffect importado
import type { Pilot } from '@/types';
import { usePilotsStore, usePilotCategoriesStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext'; // Importar useAuth
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
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
import { UnderlineKeywords } from '@/components/common/underline-keywords';


export function PilotClient() {
  const { user: currentUser } = useAuth(); // Obtener el usuario actual del contexto
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

  const handleSubmitForm = async (data: Omit<Pilot, 'id' | 'created_at'>, pilotId?: string) => {
    if (pilotId) {
      await updatePilot({ ...data, id: pilotId } as Pilot);
    } else {
      await addPilot(data);
    }
    setIsFormOpen(false);
  };

  const handleRefreshAll = useCallback(() => {
    fetchPilots();
    fetchCategories();
  }, [fetchPilots, fetchCategories]);

  useEffect(() => {
    // Fetch initial data if not already loading or loaded by AuthContext's user fetch
    // This ensures data is available even if AuthContext is slow or user is not logged in
    if (!loading && pilots.length === 0) { // Changed pilotsLoading to loading
        fetchPilots();
    }
    if (!categoriesLoading && pilotCategories.length === 0) {
        fetchCategories();
    }
  }, [fetchPilots, fetchCategories, loading, categoriesLoading, pilots.length, pilotCategories.length]); // Changed pilotsLoading to loading


  const combinedLoading = loading || categoriesLoading || !currentUser; // Considerar currentUser loading para UI
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
            {currentUser?.is_admin && ( // Solo mostrar si es admin
                <Button onClick={handleAddPilot} disabled={combinedLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Piloto
                </Button>
            )}
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
                <TableHead>Admin</TableHead>
                {currentUser?.is_admin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pilots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={currentUser?.is_admin ? 6 : 5} className="text-center h-24"> 
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
                      <TableCell>
                        {pilot.is_admin ? <ShieldCheck className="h-5 w-5 text-primary" /> : '-'}
                      </TableCell>
                      {currentUser?.is_admin && (
                        <TableCell className="text-right">
                              <>
                              <Button variant="ghost" size="icon" onClick={() => handleEditPilot(pilot)} className="mr-2 hover:text-primary">
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Editar</span>
                              </Button>
                              {/* Un admin no puede eliminar su propio perfil desde esta lista para evitar auto-bloqueo accidental */}
                              {pilot.auth_user_id !== currentUser?.id && (
                                  <Button variant="ghost" size="icon" onClick={() => handleDeletePilot(pilot)} className="hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Eliminar</span>
                                  </Button>
                              )}
                              </>
                        </TableCell>
                       )}
                       {/* Un usuario NO admin puede editar su propio perfil si está vinculado Y la columna de acciones no se renderizó para admin */}
                       {!currentUser?.is_admin && pilot.auth_user_id === currentUser?.id && (
                           <TableCell className="text-right">
                               <Button variant="ghost" size="icon" onClick={() => handleEditPilot(pilot)} className="mr-2 hover:text-primary">
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Editar</span>
                              </Button>
                              {/* No se permite auto-eliminación desde aquí */}
                           </TableCell>
                       )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Render PilotForm if the current user is an admin */}
      {currentUser?.is_admin && (
        <PilotForm
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSubmit={handleSubmitForm}
            pilot={editingPilot}
            categories={pilotCategories}
        />
      )}
       {/* Render PilotForm for a non-admin user if they are editing their own linked profile */}
      {!currentUser?.is_admin && editingPilot && editingPilot.auth_user_id === currentUser?.id && (
         <PilotForm
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSubmit={handleSubmitForm}
            pilot={editingPilot}
            categories={pilotCategories}
        />
      )}


      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={pilotToDelete ? `${pilotToDelete.first_name} ${pilotToDelete.last_name}` : 'este piloto'}
      />
    </>
  );
}
