
"use client";

import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export default function LogbookReportsPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader title="Informes y Resúmenes" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-6 w-6 text-primary" />
              Estadísticas Generales
            </CardTitle>
            <CardDescription>
              Visualiza estadísticas sobre horas de vuelo por piloto y rango de fechas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/logbook/reports/stats">Ver Estadísticas</Link>
            </Button>
             <p className="mt-2 text-xs text-center text-muted-foreground">
              Desglose de horas por tipo de vuelo.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
