
"use client";

import React, { useMemo } from 'react';
import { useAircraftStore, useCompletedEngineFlightsStore } from '@/store/data-hooks';
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wrench, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type AircraftWarning = {
  id: string;
  aircraftName: string;
  message: string;
  severity: 'critical' | 'warning';
};

export function MaintenanceWarnings() {
  const { aircraft, loading: aircraftLoading, error: aircraftError } = useAircraftStore();
  const { completedEngineFlights, loading: engineFlightsLoading, error: engineFlightsError } = useCompletedEngineFlightsStore();

  const anyLoading = aircraftLoading || engineFlightsLoading;
  const anyError = aircraftError || engineFlightsError;

  const aircraftWithCalculatedData = useMemo(() => {
    if (!aircraft.length || anyError) return [];
  
    return aircraft.map(ac => {
      if (ac.type === 'Glider' || !ac.last_oil_change_date || !isValid(parseISO(ac.last_oil_change_date))) {
        return { ...ac, hours_since_oil_change: null };
      }
  
      const lastOilChangeDate = parseISO(ac.last_oil_change_date);
      
      const relevantFlights = completedEngineFlights.filter(flight =>
        flight.engine_aircraft_id === ac.id &&
        isValid(parseISO(flight.date)) &&
        isAfter(parseISO(flight.date), lastOilChangeDate)
      );
      
      const totalHours = relevantFlights.reduce((sum, flight) => sum + (flight.flight_duration_decimal || 0), 0);
      
      return { ...ac, hours_since_oil_change: totalHours };
    });
  }, [aircraft, completedEngineFlights, anyError]);
  
  const maintenanceWarnings = useMemo<AircraftWarning[]>(() => {
    if (anyLoading || anyError) return [];

    const warnings: AircraftWarning[] = [];
    const today = startOfDay(new Date());

    aircraftWithCalculatedData.forEach(ac => {
        const isAnnualExpired = ac.annual_review_date ? isBefore(parseISO(ac.annual_review_date), today) : false;
        const isInsuranceExpired = ac.insurance_expiry_date ? isBefore(parseISO(ac.insurance_expiry_date), today) : false;
        
        // Check annual review
        if (ac.annual_review_date && isValid(parseISO(ac.annual_review_date))) {
            const reviewDate = parseISO(ac.annual_review_date);
            if (isAnnualExpired) {
                warnings.push({
                    id: `${ac.id}-annual-exp`,
                    aircraftName: `${ac.name} (Fuera de Servicio)`,
                    message: `Revisión Anual VENCIDA el ${format(reviewDate, 'dd/MM/yyyy', { locale: es })}`,
                    severity: 'critical',
                });
            } else {
                const daysDiff = differenceInDays(reviewDate, today);
                if (daysDiff <= 30) {
                    warnings.push({
                        id: `${ac.id}-annual-warn`,
                        aircraftName: ac.name,
                        message: `Revisión Anual vence en ${daysDiff} día(s)`,
                        severity: 'warning',
                    });
                }
            }
        }

        // Check insurance
        if (ac.insurance_expiry_date && isValid(parseISO(ac.insurance_expiry_date))) {
            const expiryDate = parseISO(ac.insurance_expiry_date);
            if (isInsuranceExpired) {
                warnings.push({
                    id: `${ac.id}-insurance-exp`,
                    aircraftName: `${ac.name} (Fuera de Servicio)`,
                    message: `Seguro VENCIDO el ${format(expiryDate, 'dd/MM/yyyy', { locale: es })}`,
                    severity: 'critical',
                });
            } else {
                const daysDiff = differenceInDays(expiryDate, today);
                if (daysDiff <= 30) {
                     warnings.push({
                        id: `${ac.id}-insurance-warn`,
                        aircraftName: ac.name,
                        message: `Seguro vence en ${daysDiff} día(s)`,
                        severity: 'warning',
                    });
                }
            }
        }

        // Check oil hours
        if (ac.hours_since_oil_change !== null && ac.hours_since_oil_change >= 20) {
            warnings.push({
                id: `${ac.id}-oil`,
                aircraftName: ac.name,
                message: `Requiere cambio de aceite (${ac.hours_since_oil_change.toFixed(1)} hs acumuladas)`,
                severity: 'warning',
            });
        }
        
        // Add a generic OOS warning if manually marked
        if (ac.is_out_of_service) {
            warnings.push({
                id: `${ac.id}-oos`,
                aircraftName: `${ac.name} (Fuera de Servicio)`,
                message: ac.out_of_service_reason || 'Razón no especificada.',
                severity: 'critical'
            });
        }
    });

    // Remove duplicates by ID before sorting
    const uniqueWarnings = Array.from(new Map(warnings.map(item => [item.id, item])).values());


    // Sort warnings to show critical ones first, then by aircraft name
    return uniqueWarnings.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return a.aircraftName.localeCompare(b.aircraftName);
    });
  }, [aircraftWithCalculatedData, anyLoading, anyError]);

  if (anyLoading || anyError || maintenanceWarnings.length === 0) {
    return null; // Don't render anything if loading, error, or no warnings
  }

  return (
    <Card className="mb-6 border-orange-400 bg-orange-50 shadow-md">
        <CardHeader>
            <CardTitle className="flex items-center text-lg text-orange-800">
                <Wrench className="mr-2 h-5 w-5" />
                Avisos de Mantenimiento
            </CardTitle>
            <CardDescription className="text-orange-700/90">
                Las siguientes aeronaves requieren atención. <Link href="/aircraft" className="underline hover:text-orange-800 font-semibold">Ir a Aeronaves</Link> para más detalles.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-2">
                {maintenanceWarnings.map(warning => (
                    <Alert key={warning.id} variant={warning.severity === 'critical' ? 'destructive' : 'default'}
                        className={cn(warning.severity === 'warning' && 'border-blue-400 bg-blue-50 text-blue-900 [&>svg]:text-blue-700')}
                    >
                        {warning.severity === 'critical' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                        <AlertDescription>
                            <span className="font-semibold">{warning.aircraftName}:</span> {warning.message}
                        </AlertDescription>
                    </Alert>
                ))}
            </div>
        </CardContent>
    </Card>
  );
}
