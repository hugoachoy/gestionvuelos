
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'; // Added useRef, useCallback
import SunCalc from 'suncalc';
import { format, isValid, parseISO } from 'date-fns'; // Added parseISO
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarIcon, Sunrise as SunriseIcon, Sunset as SunsetIcon, Sparkles, Sun, Moon, Save, MessageSquare, Loader2 } from 'lucide-react'; // Added Save, MessageSquare, Loader2
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
import { useAuth } from '@/contexts/AuthContext'; // Added useAuth
import { useDailyObservationsStore } from '@/store/data-hooks'; // Added useDailyObservationsStore
import { useToast } from "@/hooks/use-toast"; // Added useToast
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton

// Coordenadas del Aeroclub 9 de Julio (aproximadas)
const NUEVE_DE_JULIO_LAT = -35.4445;
const NUEVE_DE_JULIO_LON = -60.8857;
const LOCATION_NAME = "Aeroclub 9 de Julio (Lat: -35.44, Lon: -60.89)";

interface TwilightTimes {
  dawn: Date | null;
  sunrise: Date | null;
  sunset: Date | null;
  dusk: Date | null;
}

export function TwilightClient() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [twilightTimes, setTwilightTimes] = useState<TwilightTimes | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const { user: currentUser, loading: authLoading } = useAuth();
  const { getObservation, updateObservation, loading: obsLoading, fetchObservations, error: obsError } = useDailyObservationsStore();
  const { toast } = useToast();
  
  const [observationInput, setObservationInput] = useState('');
  const observationTextareaRef = useRef<HTMLTextAreaElement>(null);

  const formattedSelectedDate = useMemo(() => {
    return selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  }, [selectedDate]);
  
  const formattedSelectedDateDisplay = useMemo(() => {
    return selectedDate ? format(selectedDate, "PPP", { locale: es }) : 'Fecha no seleccionada';
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      try {
        const times = SunCalc.getTimes(selectedDate, NUEVE_DE_JULIO_LAT, NUEVE_DE_JULIO_LON);
        setTwilightTimes({
          dawn: times.dawn,
          sunrise: times.sunrise,
          sunset: times.sunset,
          dusk: times.dusk,
        });
      } catch (error) {
        console.error("Error calculating sun times:", error);
        setTwilightTimes(null);
      }
      fetchObservations(formattedSelectedDate); // Fetch observations for the selected date
    }
  }, [selectedDate, formattedSelectedDate, fetchObservations]);
  
  const savedObservationText = useMemo(() => {
    return formattedSelectedDate ? getObservation(formattedSelectedDate) : undefined;
  }, [formattedSelectedDate, getObservation]);

  useEffect(() => {
    setObservationInput(savedObservationText || '');
  }, [savedObservationText]);

  useEffect(() => {
    if (observationTextareaRef.current) {
      observationTextareaRef.current.style.height = 'auto';
      observationTextareaRef.current.style.height = `${observationTextareaRef.current.scrollHeight}px`;
    }
  }, [observationInput]);

  const handleSaveObservation = async () => {
    if (selectedDate && currentUser?.is_admin) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await updateObservation(dateStr, observationInput);
      toast({ title: "Observaciones guardadas", description: "Las observaciones para el día han sido guardadas." });
    } else if (!currentUser?.is_admin) {
      toast({ title: "Acción no permitida", description: "Solo los administradores pueden guardar observaciones.", variant: "destructive" });
    }
  };

  const formatTime = (date: Date | null): string => {
    if (date && isValid(date)) {
      return format(date, "HH:mm 'hs'", { locale: es });
    }
    return 'N/A';
  };

  const isLoadingUI = authLoading || obsLoading;

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-md mx-auto shadow-md">
        <CardHeader>
          <CardTitle>Seleccionar Fecha</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
                disabled={isLoadingUI}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formattedSelectedDateDisplay}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setIsDatePickerOpen(false);
                }}
                initialFocus
                locale={es}
                disabled={isLoadingUI}
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className="mb-6 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center">
              <MessageSquare className="mr-2 h-5 w-5 text-primary" />
              Observaciones del Día
            </CardTitle>
            <CardDescription>Notas relevantes para este día. Solo administradores pueden editar.</CardDescription>
          </CardHeader>
          <CardContent>
            {obsLoading && !observationInput && !savedObservationText ? (
                 <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    {currentUser?.is_admin && <Skeleton className="h-9 w-36" />}
                 </div>
            ) : obsError ? (
                <p className="text-destructive">Error al cargar observaciones.</p>
            ) : (
              <>
                <Textarea
                  ref={observationTextareaRef}
                  placeholder="Escribe observaciones..."
                  value={observationInput}
                  onChange={(e) => setObservationInput(e.target.value)}
                  rows={1}
                  className="mb-3 resize-none overflow-hidden"
                  disabled={isLoadingUI || !currentUser?.is_admin}
                />
                {currentUser?.is_admin && (
                  <Button onClick={handleSaveObservation} size="sm" disabled={isLoadingUI}>
                    {isLoadingUI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Observaciones
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDate && twilightTimes && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-center">
              Horarios Astronómicos para {formattedSelectedDateDisplay}
            </CardTitle>
            <CardDescription className="text-center text-sm">
              Ubicación: {LOCATION_NAME}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
            <InfoCard
              title="Inicio Crepúsculo Civil Matutino"
              time={formatTime(twilightTimes.dawn)}
              icon={<Sparkles className="h-8 w-8 text-blue-400" />}
            />
            <InfoCard
              title="Salida del Sol"
              time={formatTime(twilightTimes.sunrise)}
              icon={<SunriseIcon className="h-8 w-8 text-orange-400" />}
            />
            <InfoCard
              title="Puesta del Sol"
              time={formatTime(twilightTimes.sunset)}
              icon={<SunsetIcon className="h-8 w-8 text-red-400" />}
            />
            <InfoCard
              title="Fin Crepúsculo Civil Vespertino"
              time={formatTime(twilightTimes.dusk)}
              icon={<Moon className="h-8 w-8 text-indigo-400" />}
            />
          </CardContent>
        </Card>
      )}
      {selectedDate && !twilightTimes && !isLoadingUI && ( // Added !isLoadingUI
        <Card>
            <CardContent className="pt-6">
                <p className="text-center text-destructive">No se pudieron calcular los horarios para la fecha seleccionada.</p>
            </CardContent>
        </Card>
       )}
    </div>
  );
}

interface InfoCardProps {
  title: string;
  time: string;
  icon: React.ReactNode;
}

function InfoCard({ title, time, icon }: InfoCardProps) {
  return (
    <div className="flex flex-col items-center p-4 border rounded-lg shadow-sm bg-card/50">
      <div className="mb-2">{icon}</div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-1">{title}</h3>
      <p className="text-lg font-bold text-primary">{time}</p>
    </div>
  );
}

