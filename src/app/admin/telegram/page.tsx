
import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';
import { TelegramReportClient } from './components/telegram-report-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bot } from 'lucide-react';

export default function TelegramReportPage() {
    return (
        <>
            <PageHeader title="Configuración de Informe por Telegram" />
            <Alert className="mb-6">
                <Bot className="h-4 w-4" />
                <AlertTitle>¡Funcionalidad del Bot Ampliada!</AlertTitle>
                <AlertDescription>
                    Ahora puedes interactuar con el bot en Telegram. Envía el comando <strong>/start</strong> para ver el menú de opciones y solicitar informes a demanda.
                    El envío de prueba ahora enviará el informe de actividad de la semana pasada.
                </AlertDescription>
            </Alert>
            <Suspense fallback={<div>Cargando configuración...</div>}>
                <TelegramReportClient />
            </Suspense>
        </>
    )
}
