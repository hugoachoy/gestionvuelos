
"use client";

import React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Pilot } from '@/types';
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, RefreshCw, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';
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
import { useToast } from "@/hooks/use-toast";


export function PilotClient() {
  const auth = useAuth();
  const { pilots, addPilot, updatePilot, deletePilot: removePilot, loading, error, fetchPilots } = usePilotsStore();
  const { categories: pilotCategories, getCategoryName, loading: categoriesLoading, error: categoriesError, fetchCategories } = usePilotCategoriesStore();
  const { aircraft, loading: aircraftLoading, error: aircraftError, fetchAircraft: fetchAircrafts } = useAircraftStore();
  const { toast } = useToast();

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
      // Double check to prevent admin self-deletion, though UI should prevent this.
      if (auth.user?.is_admin && pilotToDelete.auth_user_id === auth.user?.id) {
          toast({ title: "Operación no permitida", description: "Un administrador no puede eliminar su propio perfil de piloto directamente desde esta interfaz.", variant: "destructive" });
          setIsDeleteDialogOpen(false);
          setPilotToDelete(null);
          return;
      }
      const success = await removePilot(pilotToDelete.id);
      if (!success) {
        // The store might set a more specific error. This is a fallback.
        toast({ title: "Error al Eliminar", description: "No se pudo eliminar el piloto. Revise los logs o contacte soporte.", variant: "destructive" });
      } else {
        toast({ title: "Piloto Eliminado", description: `${pilotToDelete.first_name} ${pilotToDelete.last_name} ha sido eliminado.` });
      }
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
    fetchAircrafts();
  }, [fetchPilots, fetchCategories, fetchAircrafts]);

  useEffect(() => {
    fetchPilots();
    fetchCategories();
    fetchAircrafts();
  }, [fetchPilots, fetchCategories, fetchAircrafts]);


  const combinedLoading = loading || categoriesLoading || auth.loading || !auth.user || aircraftLoading;
  const combinedError = error || categoriesError || aircraftError;

  const sortedPilots = useMemo(() => {
    // Ensure pilots is an array before trying to sort it.
    const safePilots = pilots || [];
    return [...safePilots].sort((a, b) => {
      const currentUserAuthId = auth.user?.id;
      const aIsCurrentUser = a.auth_user_id === currentUserAuthId;
      const bIsCurrentUser = b.auth_user_id === currentUserAuthId;

      if (aIsCurrentUser && !bIsCurrentUser) return -1;
      if (!aIsCurrentUser && bIsCurrentUser) return 1;

      const lastNameComp = a.last_name.localeCompare(b.last_name);
      if (lastNameComp !== 0) return lastNameComp;
      return a.first_name.localeCompare(b.first_name);
    });
  }, [pilots, auth.user]);

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
              pilots={pilots || []} 
              getCategoryName={getCategoryName}
              disabled={combinedLoading || !pilots || pilots.length === 0}
            />
            {auth.user?.is_admin && (
                <Button onClick={handleAddPilot} disabled={combinedLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Piloto
                </Button>
            )}
          </div>
        }
      />

      {combinedLoading && !sortedPilots.length ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="w-full overflow-auto rounded-lg border shadow-sm max-h-[calc(100vh-15rem)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm">
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>Categorías</TableHead>
                <TableHead>Venc. Psicofísico</TableHead>
                <TableHead>Admin</TableHead>
                {(auth.user?.is_admin || sortedPilots.some(p => p.auth_user_id === auth.user?.id)) && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPilots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={(auth.user?.is_admin || sortedPilots.some(p => p.auth_user_id === auth.user?.id)) ? 6 : 5} className="text-center h-24">
                    No hay pilotos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                sortedPilots.map((pilot) => {
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
                  const canEditThisPilot = auth.user?.is_admin || pilot.auth_user_id === auth.user?.id;
                  const canDeleteThisPilot = auth.user?.is_admin && pilot.auth_user_id !== auth.user?.id;
                  const isCurrentUserPilot = pilot.auth_user_id === auth.user?.id;

                  return (
                    <TableRow
                      key={pilot.id}
                      data-is-current-user={isCurrentUserPilot}
                      className={cn(isCurrentUserPilot && "bg-primary/10 hover:bg-primary/20 data-[is-current-user=true]:font-semibold")}
                    >
                      <TableCell>
                        <div className="flex items-center">
                          {pilot.first_name}
                          {isCurrentUserPilot && <UserCheck className="ml-2 h-4 w-4 text-primary" />}
                        </div>
                        </TableCell>
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
                      {(canEditThisPilot || canDeleteThisPilot) && (
                        <TableCell className="text-right">
                              {canEditThisPilot && (
                                <Button variant="ghost" size="icon" onClick={() => handleEditPilot(pilot)} className="mr-2 hover:text-primary">
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Editar</span>
                                </Button>
                              )}
                              {canDeleteThisPilot && (
                                  <Button variant="ghost" size="icon" onClick={() => handleDeletePilot(pilot)} className="hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Eliminar</span>
                                  </Button>
                              )}
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

      {(auth.user?.is_admin || (editingPilot && editingPilot.auth_user_id === auth.user?.id)) && (
        <PilotForm
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSubmit={handleSubmitForm}
            pilot={editingPilot}
            categories={pilotCategories}
            allowIsAdminChange={auth.user?.is_admin ?? false}
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
