
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { UserCheck, Send, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { usePilotsStore } from '@/store/data-hooks';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { sendWeeklyActivityReport } from '@/ai/flows/telegram-report-flow';


export function TelegramReportClient() {
    const { pilots, loading: pilotsLoading, getPilotName, fetchPilots } = usePilotsStore();
    const { toast } = useToast();
    
    const [selectedPilotId, setSelectedPilotId] = useState<string>('');
    const [isSending, setIsSending] = useState(false);
    const [isPilotPickerOpen, setIsPilotPickerOpen] = useState(false);
    
    useEffect(() => {
        fetchPilots();
    }, [fetchPilots]);

    const handleSendTestReport = useCallback(async () => {
        if (!selectedPilotId) {
            toast({ title: "Piloto no seleccionado", description: "Por favor, elija un piloto para enviarle el informe de prueba.", variant: "destructive" });
            return;
        }
        
        const pilot = pilots.find(p => p.id === selectedPilotId);
        if (!pilot || !pilot.telegram_chat_id) {
             toast({ title: "Sin ID de Telegram", description: "El piloto seleccionado no tiene un ID de chat de Telegram configurado en su perfil.", variant: "destructive" });
            return;
        }

        setIsSending(true);
        try {
            // Logic is hardcoded in the flow to test for Hugo Choy
            await sendWeeklyActivityReport(pilot.telegram_chat_id, pilot.id);
            toast({ title: "Informe Enviado", description: `Se ha enviado un informe de prueba a ${getPilotName(pilot.id)}.` });
        } catch (error: any) {
            console.error("Error sending test report:", error);
            toast({ title: "Error de Envío", description: `No se pudo enviar el informe: ${error.message}`, variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    }, [selectedPilotId, pilots, toast, getPilotName]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>2. Prueba de Envío Manual</CardTitle>
                <CardDescription>
                    Selecciona un piloto y envía un informe de actividad de la semana pasada para depurar o verificar la conexión del bot.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
                <Popover open={isPilotPickerOpen} onOpenChange={setIsPilotPickerOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn("w-full sm:w-auto md:w-[240px] justify-between", !selectedPilotId && "text-muted-foreground")} disabled={pilotsLoading || isSending}>
                    {selectedPilotId ? getPilotName(selectedPilotId) : "Seleccionar Piloto"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar piloto..." />
                        <CommandList>
                            <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                            <CommandGroup>
                                {pilots.filter(p => p.telegram_chat_id).map(pilot => (
                                    <CommandItem key={pilot.id} value={`${pilot.last_name}, ${pilot.first_name}`} onSelect={() => { setSelectedPilotId(pilot.id); setIsPilotPickerOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", selectedPilotId === pilot.id ? "opacity-100" : "opacity-0")} />
                                        {pilot.last_name}, {pilot.first_name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
                </Popover>
                <Button onClick={handleSendTestReport} disabled={!selectedPilotId || isSending || pilotsLoading}>
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Enviar Informe de Prueba
                </Button>
            </CardContent>
        </Card>
    );
}