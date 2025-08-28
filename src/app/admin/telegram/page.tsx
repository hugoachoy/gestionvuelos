
import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';
import { TelegramReportClient } from './components/telegram-report-client';
import { WebhookSetup } from './components/webhook-setup';
import { Separator } from '@/components/ui/separator';

export default function TelegramReportPage() {
    return (
        <>
            <PageHeader title="Configuración de Informe por Telegram" />
            
            <div className="space-y-8">
                <WebhookSetup />
                <Separator />
                <Suspense fallback={<div>Cargando configuración de informes...</div>}>
                    <TelegramReportClient />
                </Suspense>
            </div>

        </>
    )
}
