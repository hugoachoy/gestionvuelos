
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import SunCalc from 'suncalc';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarIcon, Sunrise as SunriseIcon, Sunset as SunsetIcon, Sparkles, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Coordenadas del Aeroclub 9 de Julio (aproximadas)
const NUEVE_DE_JULIO_LAT = -35.4445;
const NUEVE_DE_JULIO_LON = -60.8857;
const LOCATION_NAME = "Aeroclub 9 de Julio (Lat: -35.44, Lon: -60.89)";

interface TwilightTimes {
  dawn: Date | null;       // Inicio Crepúsculo Civil Matutino (Alba Civil)
  sunrise: Date | null;    // Salida del Sol
  sunset: Date | null;     // Puesta del Sol
  dusk: Date | null;       // Fin Crepúsculo Civil Vespertino (Ocaso Civil)
}

export function TwilightClient() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [twilightTimes, setTwilightTimes] = useState<TwilightTimes | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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
        setTwilightTimes(null); // Reset times on error
      }
    }
  }, [selectedDate]);

  const formattedSelectedDate = useMemo(() => {
    return selectedDate ? format(selectedDate, "PPP", { locale: es }) : 'Fecha no seleccionada';
  }, [selectedDate]);

  const formatTime = (date: Date | null): string => {
    if (date && isValid(date)) {
      return format(date, "HH:mm 'hs'", { locale: es });
    }
    return 'N/A';
  };

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
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formattedSelectedDate}
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
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {selectedDate && twilightTimes && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-center">
              Horarios para {formattedSelectedDate}
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
       {selectedDate && !twilightTimes && (
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
