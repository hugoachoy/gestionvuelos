
"use client";

import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';
import { TelegramReportClient } from './components/telegram-report-client';
import { Separator } from '@/components/ui/separator';
import { WebhookSetupComponent } from './components/webhook-setup';

export default function TelegramReportPage() {
    return (
        <>
            <PageHeader title="Configuración de Informe por Telegram" />
            
            <div className="space-y-8">
                <WebhookSetupComponent />
                <Separator />
                <Suspense fallback={<div>Cargando configuración de informes...</div>}>
                    <TelegramReportClient />
                </Suspense>
            </div>
        </>
    )
}
