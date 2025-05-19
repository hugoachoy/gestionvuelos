"use client";

import { useState } from 'react';
import type { Pilot, PilotCategory } from '@/types';
import { usePilotsStore, usePilotCategoriesStore } from '@/store/data-hooks';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
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

export function PilotClient() {
  const { pilots, addPilot, updatePilot, deletePilot: removePilot } = usePilotsStore();
  const { categories, getCategoryName } = usePilotCategoriesStore();
  
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

  const confirmDelete = () => {
    if (pilotToDelete) {
      removePilot(pilotToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setPilotToDelete(null);
  };

  const handleSubmitForm = (data: any, pilotId?: string) => {
    const pilotData = {
      ...data,
      medicalExpiry: format(data.medicalExpiry, 'yyyy-MM-dd'),
    };
    if (pilotId) {
      updatePilot({ ...pilotData, id: pilotId });
    } else {
      addPilot(pilotData);
    }
    setIsFormOpen(false);
  };

  return (
    <>
      <PageHeader 
        title="Pilotos" 
        action={
          <Button onClick={handleAddPilot}>
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Piloto
          </Button>
        } 
      />
      
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
                  <TableCell>{pilot.firstName}</TableCell>
                  <TableCell>{pilot.lastName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pilot.categoryIds.map(catId => (
                        <Badge key={catId} variant="secondary">{getCategoryName(catId)}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pilot.medicalExpiry ? format(parseISO(pilot.medicalExpiry), "dd/MM/yyyy", { locale: es }) : 'N/A'}
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

      <PilotForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        pilot={editingPilot}
        categories={categories}
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={pilotToDelete ? `${pilotToDelete.firstName} ${pilotToDelete.lastName}` : 'este piloto'}
      />
    </>
  );
}
