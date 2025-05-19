"use client";

import { useState } from 'react';
import type { PilotCategory } from '@/types';
import { usePilotCategoriesStore } from '@/store/data-hooks';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { CategoryForm } from './category-form';
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

export function CategoryClient() {
  const { categories, addCategory, updateCategory, deleteCategory: removeCategory } = usePilotCategoriesStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PilotCategory | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<PilotCategory | null>(null);

  const handleAddCategory = () => {
    setEditingCategory(undefined);
    setIsFormOpen(true);
  };

  const handleEditCategory = (category: PilotCategory) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  const handleDeleteCategory = (category: PilotCategory) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
      removeCategory(categoryToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleSubmitForm = (data: { name: string }, categoryId?: string) => {
    if (categoryId) {
      updateCategory({ ...data, id: categoryId });
    } else {
      addCategory(data);
    }
    setIsFormOpen(false);
  };

  return (
    <>
      <PageHeader 
        title="Categorías de Pilotos" 
        action={
          <Button onClick={handleAddCategory}>
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Categoría
          </Button>
        }
      />
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center h-24">
                  No hay categorías registradas.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>{category.name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEditCategory(category)} className="mr-2 hover:text-primary">
                      <Edit className="h-4 w-4" />
                       <span className="sr-only">Editar</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(category)} className="hover:text-destructive">
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

      <CategoryForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        category={editingCategory}
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={categoryToDelete?.name || 'esta categoría'}
      />
    </>
  );
}
