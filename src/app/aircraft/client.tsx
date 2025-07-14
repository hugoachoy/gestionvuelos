
"use client";

import React from 'react'; 
import { useState, useMemo, useCallback, useEffect } from 'react'; 
import type { Aircraft } from '@/types';
import { useAircraftStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext'; 
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { AircraftForm } from './components/aircraft-form';
import { PageHeader } from '@/components/common/page-header';
import { DeleteDialog } from '@/components/common/delete-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AircraftReportButton } from './components/aircraft-report-button';

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

export function AircraftClient() {
  const { user: currentUser, loading: authLoading } = useAuth(); 
  const { aircraftWithCalculatedData, loading, error, fetchAircraft, deleteAircraft: removeAircraft, addAircraft, updateAircraft } = useAircraftStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState<Aircraft | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [aircraftToDelete, setAircraftToDelete] = useState<Aircraft | null>(null);

  useEffect(() => {
    fetchAircraft();
  }, [fetchAircraft]);

  const handleAddAircraft = () => {
    setEditingAircraft(undefined);
    setIsFormOpen(true);
  };

  const handleEditAircraft = (ac: Aircraft) => {
    setEditingAircraft(ac);
    setIsFormOpen(true);
  };

  const handleDeleteAircraft = (ac: Aircraft) => {
    setAircraftToDelete(ac);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (aircraftToDelete) {
      await removeAircraft(aircraftToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setAircraftToDelete(null);
  };

  const handleSubmitForm = async (data: Omit<Aircraft, 'id' | 'created_at'>, aircraftId?: string) => {
    if (aircraftId) {
      await updateAircraft({ ...data, id: aircraftId } as Aircraft);
    } else {
      await addAircraft(data);
    }
    setIsFormOpen(false);
  };

  const handleRefreshData = useCallback(() => {
    fetchAircraft(true);
  }, [fetchAircraft]);

  const sortedAircraft = useMemo(() => {
    if (!aircraftWithCalculatedData || !Array.isArray(aircraftWithCalculatedData)) {
      return [];
    }
    return [...aircraftWithCalculatedData].sort((a, b) => {
      const typeOrderA = aircraftTypeOrder[a.type];
      const typeOrderB = aircraftTypeOrder[b.type];

      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [aircraftWithCalculatedData]);

  if (error) {
    return (
      <div className="text-destructive">
        Error al cargar aeronaves: {error.message}
        <Button onClick={handleRefreshData} className="ml-2">Reintentar</Button>
      </div>
    );
  }

  const isLoadingUI = loading || authLoading || !currentUser;
  const safeAircraftData = aircraftWithCalculatedData || [];

  return (
    <TooltipProvider>
      <PageHeader 
        title="Aeronaves"
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRefreshData} variant="outline" size="icon" disabled={isLoadingUI}>
              <RefreshCw className={cn("h-4 w-4", isLoadingUI && "animate-spin")} />
            </Button>
            <AircraftReportButton
              aircraft={safeAircraftData}
              disabled={isLoadingUI || safeAircraftData.length === 0}
            />
            {currentUser?.is_admin && ( 
              <Button onClick={handleAddAircraft} disabled={isLoadingUI}>
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Aeronave
              </Button>
            )}
          </div>
        }
      />
      
      {isLoadingUI && !sortedAircraft.length ? (
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
                <TableHead>Nombre/Matrícula</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Venc. Anual</TableHead>
                <TableHead>Venc. Seguro</TableHead>
                <TableHead>Últ. Cambio Aceite</TableHead>
                <TableHead>Hs. Aceite</TableHead>
                <TableHead>Aceite Agregado (Lts)</TableHead>
                {currentUser?.is_admin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAircraft.length === 0 && !isLoadingUI ? (
                <TableRow>
                  <TableCell colSpan={currentUser?.is_admin ? 9 : 8} className="text-center h-24">
                    No hay aeronaves registradas.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAircraft.map((ac) => {
                  const today = startOfDay(new Date());
                  const isAnnualExpired = ac.annual_review_date ? isBefore(parseISO(ac.annual_review_date), today) : false;
                  const isInsuranceExpired = ac.insurance_expiry_date ? isBefore(parseISO(ac.insurance_expiry_date), today) : false;

                  const isEffectivelyOutOfService = ac.is_out_of_service || isAnnualExpired || isInsuranceExpired;
                  let effectiveOutOfServiceReason = ac.is_out_of_service ? ac.out_of_service_reason : null;
                  if (!effectiveOutOfServiceReason) {
                    if (isAnnualExpired) effectiveOutOfServiceReason = 'Revisión Anual vencida';
                    else if (isInsuranceExpired) effectiveOutOfServiceReason = 'Seguro vencido';
                  }

                  let annualReviewDisplay: React.ReactNode = 'N/A';
                  if (ac.annual_review_date && isValid(parseISO(ac.annual_review_date))) {
                    const reviewDate = parseISO(ac.annual_review_date);
                    const formattedDate = format(reviewDate, "dd/MM/yyyy", { locale: es });
                    const daysDiff = differenceInDays(reviewDate, today);

                    if (isAnnualExpired) {
                        annualReviewDisplay = <Badge variant="destructive">VENCIDA {formattedDate}</Badge>;
                    } else if (daysDiff <= 30) {
                        annualReviewDisplay = <Badge variant="destructive">Vence en {daysDiff} días</Badge>;
                    } else if (daysDiff <= 60) {
                        annualReviewDisplay = <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">Vence en {daysDiff} días</Badge>;
                    } else {
                        annualReviewDisplay = formattedDate;
                    }
                  }

                  let insuranceExpiryDisplay: React.ReactNode = 'N/A';
                  if (ac.insurance_expiry_date && isValid(parseISO(ac.insurance_expiry_date))) {
                      const expiryDate = parseISO(ac.insurance_expiry_date);
                      const formattedDate = format(expiryDate, "dd/MM/yyyy", { locale: es });
                      const daysDiff = differenceInDays(expiryDate, today);

                      if (isInsuranceExpired) {
                          insuranceExpiryDisplay = <Badge variant="destructive">VENCIDO {formattedDate}</Badge>;
                      } else if (daysDiff <= 30) {
                          insuranceExpiryDisplay = <Badge variant="destructive">Vence en {daysDiff} días</Badge>;
                      } else if (daysDiff <= 60) {
                          insuranceExpiryDisplay = <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">Vence en {daysDiff} días</Badge>;
                      } else {
                          insuranceExpiryDisplay = formattedDate;
                      }
                  }

                  let lastOilChangeDateDisplay: React.ReactNode = '-';
                  if (ac.last_oil_change_date && isValid(parseISO(ac.last_oil_change_date))) {
                     lastOilChangeDateDisplay = format(parseISO(ac.last_oil_change_date), "dd/MM/yyyy", { locale: es });
                  }
                  
                  return (
                    <TableRow key={ac.id}>
                      <TableCell>{ac.name}</TableCell>
                      <TableCell>
                        <Badge variant={ac.type === 'Tow Plane' ? 'default' : ac.type === 'Glider' ? 'secondary' : 'outline'}>
                          {aircraftTypeTranslations[ac.type] || ac.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isEffectivelyOutOfService ? (
                          <div className="flex flex-col items-start">
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" /> Fuera de Servicio
                            </Badge>
                            {effectiveOutOfServiceReason && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={effectiveOutOfServiceReason}>
                                    {effectiveOutOfServiceReason}
                                </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                             <CheckCircle className="mr-1 h-3 w-3" /> En Servicio
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{annualReviewDisplay}</TableCell>
                      <TableCell>{insuranceExpiryDisplay}</TableCell>
                      <TableCell>{lastOilChangeDateDisplay}</TableCell>
                      <TableCell>
                        {(ac as any).hours_since_oil_change !== null && (ac as any).hours_since_oil_change !== undefined ? (
                           <div className="flex items-center gap-2">
                            <span>{(ac as any).hours_since_oil_change.toFixed(1)} hs</span>
                            {(ac as any).hours_since_oil_change >= 20 && (
                                <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Revisar</Badge>
                            )}
                           </div>
                        ) : '-'}
                      </TableCell>
                       <TableCell>
                        {(ac.type !== 'Glider' && (ac as any).total_oil_added_since_review !== null && (ac as any).total_oil_added_since_review !== undefined) ? 
                            `${(ac as any).total_oil_added_since_review} Lts` : '-'
                        }
                      </TableCell>
                      {currentUser?.is_admin && ( 
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditAircraft(ac)} className="mr-2 hover:text-primary">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAircraft(ac)} className="hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
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

      {currentUser?.is_admin && ( 
        <AircraftForm
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSubmit={handleSubmitForm}
            aircraft={editingAircraft}
        />
      )}
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={aircraftToDelete?.name || 'esta aeronave'}
      />
    </TooltipProvider>
  );
}
