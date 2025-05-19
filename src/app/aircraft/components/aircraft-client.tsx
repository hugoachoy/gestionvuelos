"use client";

import { useState } from 'react';
import type { Aircraft } from '@/types';
import { useAircraftStore } from '@/store/data-hooks';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { AircraftForm } from './aircraft-form';
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

const aircraftTypeTranslations: Record<Aircraft['type'], string> = {
  'Tow Plane': 'Avión Remolcador',
  'Glider': 'Planeador',
};

export function AircraftClient() {
  const { aircraft, addAircraft, updateAircraft, deleteAircraft: removeAircraft } = useAircraftStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState<Aircraft | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [aircraftToDelete, setAircraftToDelete] = useState<Aircraft | null>(null);

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

  const confirmDelete = () => {
    if (aircraftToDelete) {
      removeAircraft(aircraftToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setAircraftToDelete(null);
  };

  const handleSubmitForm = (data: Omit<Aircraft, 'id'>, aircraftId?: string) => {
    if (aircraftId) {
      updateAircraft({ ...data, id: aircraftId });
    } else {
      addAircraft(data);
    }
    setIsFormOpen(false);
  };

  return (
    <>
      <PageHeader 
        title="Aeronaves"
        action={
          <Button onClick={handleAddAircraft}>
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Aeronave
          </Button>
        }
      />
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre/Matrícula</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aircraft.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">
                  No hay aeronaves registradas.
                </TableCell>
              </TableRow>
            ) : (
              aircraft.map((ac) => (
                <TableRow key={ac.id}>
                  <TableCell>{ac.name}</TableCell>
                  <TableCell>
                    <Badge variant={ac.type === 'Tow Plane' ? 'default' : 'outline'}>
                      {aircraftTypeTranslations[ac.type]}
                    </Badge>
                  </TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AircraftForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        aircraft={editingAircraft}
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={aircraftToDelete?.name || 'esta aeronave'}
      />
    </>
  );
}
