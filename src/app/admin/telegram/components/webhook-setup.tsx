
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Copy } from 'lucide-react';

export const WebhookSetupComponent = () => {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [botToken, setBotToken] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setWebhookUrl(`${window.location.origin}/api/telegram/webhook`);
        }
    }, []);

    const fullCommand = `curl -F "url=${webhookUrl}" https://api.telegram.org/bot${botToken || '<YOUR_BOT_TOKEN>'}/setWebhook`;

    const handleCopyCommand = () => {
        if (!botToken) {
            toast({
                title: "Falta el Token",
                description: "Por favor, ingresa el token de tu bot primero.",
                variant: "destructive"
            });
            return;
        }
        navigator.clipboard.writeText(fullCommand);
        toast({
            title: "Comando Copiado",
            description: "El comando para configurar el webhook ha sido copiado al portapapeles."
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>1. Configurar Webhook</CardTitle>
                <CardDescription>
                    Para que el bot pueda recibir mensajes, debes indicarle a Telegram la URL de tu aplicación.
                    Este paso solo se necesita hacer una vez, o si la URL de tu aplicación cambia.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="webhook-url">URL del Webhook (Automática)</Label>
                    <Input id="webhook-url" readOnly value={webhookUrl} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="bot-token">Token de tu Bot de Telegram</Label>
                    <Input
                        id="bot-token"
                        placeholder="Pega el token de tu bot aquí (Ej: 123456:ABC-DEF1234...)"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Comando para ejecutar en tu Terminal</Label>
                    <div className="flex items-center gap-2">
                        <Input readOnly value={fullCommand} className="font-mono text-xs" />
                        <Button variant="outline" size="icon" onClick={handleCopyCommand}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                     <p className="text-sm text-muted-foreground">
                        Copia y pega este comando en la terminal de tu computadora y ejecútalo. Si todo va bien, verás una respuesta como `{"ok":true,"result":true,"description":"Webhook was set"}`.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};