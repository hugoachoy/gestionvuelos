
"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserCheck } from "lucide-react";


export function TelegramReportClient() {
    return (
        <div className="space-y-6 max-w-2xl">
             <Alert variant="default" className="border-blue-500 bg-blue-50">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">Instrucciones para Pilotos</AlertTitle>
                <AlertDescription className="text-blue-700/90">
                    Para recibir los informes automáticos semanales, cada piloto debe:
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Iniciar un chat privado con el bot de Telegram del aeroclub (@tuvuelitobot).</li>
                        <li>Enviar el comando <strong>/start</strong>. El bot le responderá con su ID de chat numérico.</li>
                        <li>Copiar ese ID y pegarlo en el campo &quot;Telegram Chat ID&quot; de su <a href="/pilots" className="font-semibold underline hover:text-blue-800">ficha de piloto</a>.</li>
                    </ol>
                </AlertDescription>
            </Alert>
        </div>
    );
}
