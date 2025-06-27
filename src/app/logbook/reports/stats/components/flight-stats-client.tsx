
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCompletedGliderFlightsStore, useCompletedEngineFlightsStore, usePilotsStore } from '@/store/data-hooks';
import type { CompletedGliderFlight, CompletedEngineFlight } from '@/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, FileText, Loader2, Check, ChevronsUpDown, BarChart, Plane, Feather } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle } from "@/components/ui/chart";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface FlightStats {
  gliderTotalHours: number;
  gliderInstructionTakenHours: number;
  gliderInstructionGivenHours: number;
  gliderOtherHours: number;
  engineTotalHours: number;
  engineInstructionTakenHours: number;
  engineInstructionGivenHours: number;
  engineTowHours: number;
  engineOtherHours: number;
}

export function FlightStatsClient() {
  const { fetchCompletedGliderFlightsForRange, loading: gliderFlightsLoading } = useCompletedGliderFlightsStore();
  const { fetchCompletedEngineFlightsForRange, loading: engineFlightsLoading } = useCompletedEngineFlightsStore();
  const { getPilotName, pilots, loading: pilotsLoading, fetchPilots } = usePilotsStore();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedPilotId, setSelectedPilotId] = useState<string>('all');
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [isPilotPickerOpen, setIsPilotPickerOpen] = useState(false);
  const [statsData, setStatsData] = useState<FlightStats | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentUserPilotId, setCurrentUserPilotId] = useState<string | null>(null);

  useEffect(() => {
    fetchPilots();
  }, [fetchPilots]);

  useEffect(() => {
    if (currentUser && !currentUser.is_admin && pilots.length > 0) {
      const foundPilot = pilots.find(p => p.auth_user_id === currentUser.id);
      setCurrentUserPilotId(foundPilot?.id || null);
    }
  }, [currentUser, pilots]);

  const handleGenerateStats = useCallback(async () => {
    if (!startDate || !endDate) {
      toast({ title: "Fechas Requeridas", description: "Por favor, seleccione un rango de fechas.", variant: "destructive" });
      return;
    }
    if (endDate < startDate) {
      toast({ title: "Rango Inválido", description: "La fecha de fin no puede ser anterior a la fecha de inicio.", variant: "destructive" });
      return;
    }

    const pilotIdToFetch = currentUser?.is_admin ? (selectedPilotId === 'all' ? undefined : selectedPilotId) : currentUserPilotId;
    
    if (!currentUser?.is_admin && !pilotIdToFetch) {
      toast({ title: "Perfil no encontrado", description: "No se encontró un perfil de piloto asociado a tu usuario.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setStatsData(null);

    const gliderFlightsPromise = fetchCompletedGliderFlightsForRange(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), pilotIdToFetch);
    const engineFlightsPromise = fetchCompletedEngineFlightsForRange(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), pilotIdToFetch);

    const [gliderData, engineData] = await Promise.all([gliderFlightsPromise, engineFlightsPromise]);

    if (gliderData === null || engineData === null) {
      toast({ title: "Error al Generar", description: "No se pudieron obtener los datos de vuelo.", variant: "destructive" });
      setIsGenerating(false);
      return;
    }

    if (gliderData.length === 0 && engineData.length === 0) {
      toast({ title: "Sin Resultados", description: "No se encontraron vuelos para los filtros seleccionados." });
    }

    // Calculate stats
    const newStats: FlightStats = {
      gliderTotalHours: 0,
      gliderInstructionTakenHours: 0,
      gliderInstructionGivenHours: 0,
      gliderOtherHours: 0,
      engineTotalHours: 0,
      engineInstructionTakenHours: 0,
      engineInstructionGivenHours: 0,
      engineTowHours: 0,
      engineOtherHours: 0,
    };

    gliderData.forEach(flight => {
      newStats.gliderTotalHours += flight.flight_duration_decimal;
      switch (flight.flight_purpose) {
        case 'Instrucción (Recibida)':
        case 'readaptación':
        case 'entrenamiento':
          newStats.gliderInstructionTakenHours += flight.flight_duration_decimal;
          break;
        case 'Instrucción (Impartida)':
          newStats.gliderInstructionGivenHours += flight.flight_duration_decimal;
          break;
        default:
          newStats.gliderOtherHours += flight.flight_duration_decimal;
          break;
      }
    });

    if (pilotIdToFetch) { // Logic for a specific pilot
        engineData.forEach(flight => {
            if (flight.pilot_id === pilotIdToFetch) {
                newStats.engineTotalHours += flight.flight_duration_decimal;
                if (flight.flight_purpose === 'instrucción' || flight.flight_purpose === 'readaptación' || flight.flight_purpose === 'entrenamiento') {
                    newStats.engineInstructionTakenHours += flight.flight_duration_decimal;
                } else if (flight.flight_purpose === 'Remolque planeador') {
                    newStats.engineTowHours += flight.flight_duration_decimal;
                } else {
                    newStats.engineOtherHours += flight.flight_duration_decimal;
                }
            } else if (flight.instructor_id === pilotIdToFetch && (flight.flight_purpose === 'instrucción' || flight.flight_purpose === 'readaptación')) {
                newStats.engineInstructionGivenHours += flight.flight_duration_decimal;
            }
        });
    } else { // Logic for "All Pilots"
        engineData.forEach(flight => {
            newStats.engineTotalHours += flight.flight_duration_decimal;
            if (flight.flight_purpose === 'instrucción' || flight.flight_purpose === 'readaptación' || flight.flight_purpose === 'entrenamiento') {
                newStats.engineInstructionTakenHours += flight.flight_duration_decimal;
            } else if (flight.flight_purpose === 'Remolque planeador') {
                newStats.engineTowHours += flight.flight_duration_decimal;
            } else {
                newStats.engineOtherHours += flight.flight_duration_decimal;
            }
        });
    }

    setStatsData(newStats);
    setIsGenerating(false);
  }, [startDate, endDate, currentUser?.is_admin, selectedPilotId, currentUserPilotId, fetchCompletedGliderFlightsForRange, fetchCompletedEngineFlightsForRange, toast]);

  const isLoadingUI = authLoading || gliderFlightsLoading || engineFlightsLoading || pilotsLoading || isGenerating;
  
  const gliderChartData = useMemo(() => statsData ? [
    { name: 'Inst. Recibida', value: statsData.gliderInstructionTakenHours, fill: 'hsl(var(--chart-1))' },
    { name: 'Inst. Impartida', value: statsData.gliderInstructionGivenHours, fill: 'hsl(var(--chart-2))' },
    { name: 'Otros', value: statsData.gliderOtherHours, fill: 'hsl(var(--chart-3))' },
  ].filter(item => item.value > 0) : [], [statsData]);

  const engineChartData = useMemo(() => {
    if (!statsData) return [];
    if (selectedPilotId !== 'all') {
      return [
        { name: 'Inst. Recibida', value: statsData.engineInstructionTakenHours, fill: 'hsl(var(--chart-1))' },
        { name: 'Inst. Impartida', value: statsData.engineInstructionGivenHours, fill: 'hsl(var(--chart-2))' },
        { name: 'Remolque', value: statsData.engineTowHours, fill: 'hsl(var(--chart-4))' },
        { name: 'Otros', value: statsData.engineOtherHours, fill: 'hsl(var(--chart-5))' },
      ].filter(item => item.value > 0);
    } else {
      return [
        { name: 'Instrucción', value: statsData.engineInstructionTakenHours, fill: 'hsl(var(--chart-1))' },
        { name: 'Remolque', value: statsData.engineTowHours, fill: 'hsl(var(--chart-4))' },
        { name: 'Otros', value: statsData.engineOtherHours, fill: 'hsl(var(--chart-5))' },
      ].filter(item => item.value > 0);
    }
  }, [statsData, selectedPilotId]);
  
  const chartConfig = {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-card flex-wrap">
        <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant={"outline"} className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !startDate && "text-muted-foreground")} disabled={isLoadingUI}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP", { locale: es }) : <span>Fecha de Inicio</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setIsStartDatePickerOpen(false); }} initialFocus locale={es} />
          </PopoverContent>
        </Popover>

        <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant={"outline"} className={cn("w-full sm:w-auto md:w-[240px] justify-start text-left font-normal", !endDate && "text-muted-foreground")} disabled={isLoadingUI}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP", { locale: es }) : <span>Fecha de Fin</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setIsEndDatePickerOpen(false); }} disabled={(date) => startDate && date < startDate} initialFocus locale={es} />
          </PopoverContent>
        </Popover>
        
        {currentUser?.is_admin && (
           <Popover open={isPilotPickerOpen} onOpenChange={setIsPilotPickerOpen}>
              <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("w-full sm:w-auto md:w-[240px] justify-between", !selectedPilotId && "text-muted-foreground")} disabled={isLoadingUI}>
                  {selectedPilotId === 'all' ? 'Todos los Pilotos' : getPilotName(selectedPilotId)}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                      <CommandInput placeholder="Buscar piloto..." />
                      <CommandList>
                          <CommandEmpty>No se encontraron pilotos.</CommandEmpty>
                          <CommandGroup>
                              <CommandItem value="all" onSelect={() => { setSelectedPilotId('all'); setIsPilotPickerOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", selectedPilotId === 'all' ? "opacity-100" : "opacity-0")} />
                                  Todos los Pilotos
                              </CommandItem>
                              {pilots.map(pilot => (
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
        )}

        <Button onClick={handleGenerateStats} disabled={isLoadingUI || !startDate || !endDate} className="w-full sm:w-auto">
          {isLoadingUI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Generar Estadísticas
        </Button>
      </div>

      {isLoadingUI && !statsData && (
         <div className="grid gap-6 md:grid-cols-2 mt-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {statsData && (
        <div className="grid gap-6 md:grid-cols-2 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Feather />Vuelos en Planeador</CardTitle>
              <CardDescription>Total PIC: <span className="font-bold text-primary">{statsData.gliderTotalHours.toFixed(1)} hs</span></CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1 mb-4">
                  <p>Instrucción Recibida/Práctica: <span className="font-semibold">{statsData.gliderInstructionTakenHours.toFixed(1)} hs</span></p>
                  <p>Instrucción Impartida: <span className="font-semibold">{statsData.gliderInstructionGivenHours.toFixed(1)} hs</span></p>
                  <p>Otros Vuelos (Deportivo, etc.): <span className="font-semibold">{statsData.gliderOtherHours.toFixed(1)} hs</span></p>
              </div>
               <ChartContainer config={chartConfig} className="h-[150px] w-full">
                <RechartsBarChart accessibilityLayer data={gliderChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                  <Bar dataKey="value" radius={5} />
                </RechartsBarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plane />Vuelos a Motor</CardTitle>
              <CardDescription>
                {selectedPilotId !== 'all' ? `Total PIC: ` : `Total Club: `}
                <span className="font-bold text-primary">{statsData.engineTotalHours.toFixed(1)} hs</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="text-sm space-y-1 mb-4">
                  {selectedPilotId !== 'all' ? (
                      <>
                          <p>Instrucción Recibida: <span className="font-semibold">{statsData.engineInstructionTakenHours.toFixed(1)} hs</span></p>
                          <p>Instrucción Impartida: <span className="font-semibold">{statsData.engineInstructionGivenHours.toFixed(1)} hs</span></p>
                      </>
                  ) : (
                      <p>Instrucción (Total): <span className="font-semibold">{statsData.engineInstructionTakenHours.toFixed(1)} hs</span></p>
                  )}
                  <p>Remolque: <span className="font-semibold">{statsData.engineTowHours.toFixed(1)} hs</span></p>
                  <p>Otros Vuelos (Local, Travesía): <span className="font-semibold">{statsData.engineOtherHours.toFixed(1)} hs</span></p>
              </div>
              <ChartContainer config={chartConfig} className="h-[150px] w-full">
                <RechartsBarChart accessibilityLayer data={engineChartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                  <Bar dataKey="value" radius={5} />
                </RechartsBarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoadingUI && statsData && (statsData.gliderTotalHours + statsData.engineTotalHours) === 0 && (
         <div className="text-center text-muted-foreground mt-4 p-4 border rounded-lg">
          No se encontraron vuelos para los filtros seleccionados.
        </div>
      )}

    </div>
  );
}
