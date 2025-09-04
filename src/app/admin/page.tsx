
"use client";

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Receipt, Sheet, Bot } from 'lucide-react';

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Administración" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="mr-2 h-6 w-6 text-primary" />
              Informe de Facturación
            </CardTitle>
            <CardDescription>
              Genera un detalle de los vuelos y remolques a facturar para un piloto en un rango de fechas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/logbook/reports/billing">Generar Informe de Facturación</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Sheet className="mr-2 h-6 w-6 text-primary" />
              Gestión de Tarifas
            </CardTitle>
            <CardDescription>
              Define y actualiza los precios de horas de vuelo, remolques y otros conceptos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/rates">Gestionar Tarifas</Link>
            </Button>
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="mr-2 h-6 w-6 text-primary" />
              Configuración de Telegram
            </CardTitle>
            <CardDescription>
              Configura el webhook del bot y envía informes de prueba a los pilotos para depuración.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/telegram">Configurar Telegram</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
