"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

interface AvailabilityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Kept props for compatibility with parent component
  onSubmit: (data: any, entryId?: string) => void;
  entry?: any;
  pilots: any[];
  categories: any[];
  aircraft: any[];
  selectedDate?: Date;
  existingEntries?: any[];
}

export function AvailabilityForm({
  open,
  onOpenChange,
}: AvailabilityFormProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-red-200">
        <DialogHeader>
          <DialogTitle className="flex items-center text-red-900">
            <AlertTriangle className="mr-2 h-6 w-6" />
            PRUEBA DE DEPURACIÓN
          </DialogTitle>
          <DialogDescription className="text-red-800">
            Si ves este mensaje, significa que finalmente estoy editando el archivo correcto: 
            <br />
            <strong>/src/components/schedule/availability-form.tsx</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="text-center p-4 text-red-900 font-semibold">
           Podemos proceder a restaurar el formulario y aplicar los cambios que necesitas.
        </div>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
