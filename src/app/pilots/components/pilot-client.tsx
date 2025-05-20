
"use client";

import { useState } from 'react';
import type { Pilot, PilotCategory } from '@/types';
import { usePilotsStore, usePilotCategoriesStore } from '@/store/data-hooks';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, RefreshCw } from 'lucide-react';
import { PilotForm } from './pilot-form';
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
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

  // PilotFormData from the form is Omit<Pilot, 'id' | 'created_at'>, which matches addPilot.
  // For updatePilot, we spread the id.
  const handleSubmitForm = async (data: Omit<Pilot, 'id' | 'created_at'>, pilotId?: string) => {
    if (pilotId) {
      // Ensure data includes the id for update
      await updatePilot({ ...data, id: pilotId });
    } else {
      await addPilot(data);
    }
    setIsFormOpen(false);
  };

  const combinedLoading = loading || categoriesLoading;
  const combinedError = error || categoriesError;

  if (combinedError) {
    return (
      <div className="text-destructive">
        Error al cargar datos: {combinedError.message}
        <Button onClick={() => { fetchPilots(); fetchCategories(); }} className="ml-2">Reintentar</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader 
        title="Pilotos" 
        action={
          <div className="flex gap-2">
            <Button onClick={() => { fetchPilots(); fetchCategories(); }} variant="outline" size="icon" disabled={combinedLoading}>
              <RefreshCw className={cn("h-4 w-4", combinedLoading && "animate-spin")} />
            </Button>
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
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pilots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No hay pilotos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                pilots.map((pilot) => (
                  <TableRow key={pilot.id}>
                    <TableCell>{pilot.first_name}</TableCell>
                    <TableCell>{pilot.last_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {pilot.category_ids.map(catId => (
                          <Badge key={catId} variant="secondary">{getCategoryName(catId)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pilot.medical_expiry ? format(parseISO(pilot.medical_expiry), "dd/MM/yyyy", { locale: es }) : 'N/A'}
                    </TableCell>
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
                ))
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
