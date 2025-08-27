
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import useLocalStorageState from "@/hooks/use-local-storage-state";
import { Loader2, Send } from "lucide-react";
import { sendWeeklyActivityReport } from "@/ai/flows/telegram-report-flow";


export function TelegramReportClient() {
    const [isReportEnabled, setIsReportEnabled] = useLocalStorageState<boolean>('telegramReportEnabled', false);
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    const handleToggleReport = (enabled: boolean) => {
        setIsReportEnabled(enabled);
        toast({
            title: "Configuración guardada",
            description: `El envío automático del informe de actividad semanal ha sido ${enabled ? 'habilitado' : 'deshabilitado'}.`,
        });
    };
    
    const handleSendTest = async () => {
        // Client-side check
        if (!process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || !process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID) {
            toast({
                title: "Configuración Incompleta",
                description: "Por favor, configure el TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en su archivo .env y reinicie el servidor.",
                variant: "destructive",
                duration: 7000,
            });
            return;
        }

        setIsSending(true);
        try {
            const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
            if (!chatId) throw new Error("Chat ID no configurado");
            await sendWeeklyActivityReport(chatId);
            toast({
                title: "Informe de prueba enviado",
                description: "Se ha enviado el informe de actividad de los últimos 7 días al canal de Telegram configurado.",
            });
        } catch (error: any) {
            console.error("Error sending test report:", error);
            toast({
                title: "Error al enviar",
                description: error.message || "No se pudo enviar el informe de prueba.",
                variant: "destructive",
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card className="max-w-xl">
            <CardHeader>
                <CardTitle>Informe Automático</CardTitle>
                <CardDescription>
                    Habilita esta opción para enviar un resumen de la actividad de los últimos 7 días al canal de Telegram todos los lunes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center space-x-4 rounded-md border p-4">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="report-switch" className="text-base">
                            Enviar Informe de Actividad Semanal
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            {isReportEnabled ? "El informe se enviará automáticamente." : "El informe no se enviará."}
                        </p>
                    </div>
                    <Switch
                        id="report-switch"
                        checked={isReportEnabled}
                        onCheckedChange={handleToggleReport}
                    />
                </div>

                <div className="space-y-2">
                    <h3 className="text-base font-medium">Prueba de Envío</h3>
                     <p className="text-sm text-muted-foreground">
                        Usa este botón para enviar el informe de actividad de los últimos 7 días ahora mismo.
                    </p>
                    <Button onClick={handleSendTest} disabled={isSending}>
                        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Enviar Informe de Prueba
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
