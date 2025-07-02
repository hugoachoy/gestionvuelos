
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { triggerWeeklySummary } from '../actions';
import type { WeeklySummaryStatus } from '@/ai/flows/send-weekly-summary';

export function AdminClient() {
  const [isSending, setIsSending] = useState(false);
  const [summaryResult, setSummaryResult] = useState<WeeklySummaryStatus | null>(null);
  const { toast } = useToast();

  const handleSendTest = async () => {
    setIsSending(true);
    setSummaryResult(null);

    try {
      const result = await triggerWeeklySummary();
      setSummaryResult(result);
      toast({
        title: "Envío de Prueba Completado",
        description: `Se enviaron ${result.sentCount} correos y fallaron ${result.failedCount}.`,
      });
    } catch (error: any) {
      console.error("Error triggering weekly summary:", error);
      toast({
        title: "Error en el Envío",
        description: error.message || "Ocurrió un error al intentar enviar los correos.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Semanal por Correo</CardTitle>
        <CardDescription>
          Esta acción buscará todos los vuelos de la semana pasada y enviará un correo de resumen a cada piloto con actividad. Este proceso puede tardar unos minutos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSendTest} disabled={isSending}>
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isSending ? 'Enviando Resúmenes...' : 'Enviar Resumen Semanal de Prueba'}
        </Button>

        {summaryResult && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Resultados del Envío</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Correos enviados: <span className="font-bold">{summaryResult.sentCount}</span></p>
              <p>Correos fallidos: <span className="font-bold text-destructive">{summaryResult.failedCount}</span></p>
              <details className="mt-4">
                <summary className="cursor-pointer font-medium">Ver detalles...</summary>
                <pre className="mt-2 p-4 bg-background rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(summaryResult.details, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
