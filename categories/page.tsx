import { CategoryClient } from './components/category-client';
import { Suspense } from 'react';

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div>Cargando categorías...</div>}>
      <CategoryClient />
    </Suspense>
  );
}
