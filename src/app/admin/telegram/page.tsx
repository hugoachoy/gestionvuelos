
import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';
import { TelegramReportClient } from './components/telegram-report-client';

export default function TelegramReportPage() {
    return (
        <>
            <PageHeader title="Configuración de Informe por Telegram" />
            <Suspense fallback={<div>Cargando configuración...</div>}>
                <TelegramReportClient />
            </Suspense>
        </>
    )
}
