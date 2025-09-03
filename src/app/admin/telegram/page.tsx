
"use client";

import { PageHeader } from '@/components/common/page-header';
import { Suspense } from 'react';
import { TelegramReportClient } from './components/telegram-report-client';
import { Separator } from '@/components/ui/separator';
import { WebhookSetupComponent } from './components/webhook-setup';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserCheck } from 'lucide-react';
import React from 'react';

export default function TelegramReportPage() {
    return (
        <>
            <PageHeader title="Configuración de Informe por Telegram" />
            
            <div className="space-y-8">
                <Alert variant="default" className="border-blue-500 bg-blue-50">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-700">Instrucciones para Pilotos</AlertTitle>
                    <AlertDescription className="text-blue-700/90">
                        Para recibir los informes automáticos semanales, cada piloto debe:
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                            <li>Iniciar un chat privado con el bot de Telegram del aeroclub (si no lo has hecho ya).</li>
                            <li>Enviar el comando <strong>/start</strong>. Si el bot está bien configurado, responderá con un menú.</li>
                            <li>Enviar el comando <strong>/testpilot</strong>. El bot te responderá con tu ID de chat numérico.</li>
                            <li>Copiar ese ID y pegarlo en el campo &quot;Telegram Chat ID&quot; de su <a href="/pilots" className="font-semibold underline hover:text-blue-800">ficha de piloto</a>.</li>
                        </ol>
                    </AlertDescription>
                </Alert>

                <WebhookSetupComponent />

                <Separator />
                
                <Suspense fallback={<div>Cargando configuración de informes...</div>}>
                    <TelegramReportClient />
                </Suspense>
            </div>
        </>
    );
}