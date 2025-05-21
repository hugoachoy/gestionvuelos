
"use client";

import React from 'react'; // Added explicit React import
import { useState } from 'react';
import type { PilotCategory } from '@/types';
import { usePilotCategoriesStore } from '@/store/data-hooks';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, RefreshCw } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function CategoryClient() {
  const { categories, addCategory, updateCategory, deleteCategory: removeCategory, loading, error, fetchCategories } = usePilotCategoriesStore();
  
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

  const confirmDelete = async () => {
    if (categoryToDelete) {
      await removeCategory(categoryToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleSubmitForm = async (data: { name: string }, categoryId?: string) => {
    if (categoryId) {
      await updateCategory({ ...data, id: categoryId });
    } else {
      await addCategory(data);
    }
    setIsFormOpen(false);
  };

  if (error) {
    return (
      <div className="text-destructive">
        Error al cargar categorías: {error.message}
        <Button onClick={() => fetchCategories()} className="ml-2">Reintentar</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader 
        title="Categorías de Pilotos" 
        action={
          <div className="flex gap-2">
            <Button onClick={() => fetchCategories()} variant="outline" size="icon" disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button onClick={handleAddCategory} disabled={loading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Categoría
            </Button>
          </div>
        }
      />
      
      {loading && !categories.length ? (
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
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center h-24">
                    No hay categorías registradas. (Asegúrese de crearlas en Supabase si es la primera vez)
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
      )}

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
