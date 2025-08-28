
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import useLocalStorageState from "@/hooks/use-local-storage-state";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bot, UserCheck } from "lucide-react";


export function TelegramReportClient() {
    const [isReportEnabled, setIsReportEnabled] = useLocalStorageState<boolean>('telegramReportEnabled', false);
    const { toast } = useToast();

    const handleToggleReport = (enabled: boolean) => {
        setIsReportEnabled(enabled);
        toast({
            title: "Configuración guardada",
            description: `El envío automático de informes semanales personales ha sido ${enabled ? 'habilitado' : 'deshabilitado'}.`,
        });
        // Here you would typically call a server action to save this setting in a database
        // so the cron job can check it.
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <Alert>
                <Bot className="h-4 w-4" />
                <AlertTitle>Nuevo Sistema de Reportes Personales</AlertTitle>
                <AlertDescription>
                    El sistema ahora envía un informe de actividad semanal personalizado a cada piloto que haya configurado su ID de Telegram.
                    La opción a continuación habilita o deshabilita este envío automático para todos los pilotos.
                </AlertDescription>
            </Alert>
             <Alert variant="default" className="border-blue-500 bg-blue-50">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">Instrucciones para Pilotos</AlertTitle>
                <AlertDescription className="text-blue-700/90">
                    Para recibir los informes, cada piloto debe iniciar un chat privado con el bot, escribir <strong>/start</strong> y seguir las instrucciones para configurar su ID de chat de Telegram en su perfil.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle>Informe Automático Semanal Personal</CardTitle>
                    <CardDescription>
                        Habilita esta opción para que el sistema envíe un resumen de su propia actividad de la semana pasada a cada piloto todos los lunes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-4 rounded-md border p-4">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="report-switch" className="text-base">
                                Enviar Informes Semanales Personales
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {isReportEnabled ? "El envío automático está HABILITADO." : "El envío automático está DESHABILITADO."}
                            </p>
                        </div>
                        <Switch
                            id="report-switch"
                            checked={isReportEnabled}
                            onCheckedChange={handleToggleReport}
                        />
                    </div>
                     <p className="text-xs text-muted-foreground">
                        Nota: Esta configuración se guarda en tu navegador. Para una solución permanente, este ajuste debería guardarse en la base de datos para que el servidor (cron job) pueda leerlo.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
