
"use client";

import React, { useMemo } from 'react';
import { useAircraftStore, useCompletedEngineFlightsStore } from '@/store/data-hooks';
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type WarningMessage = {
  message: string;
  severity: 'critical' | 'warning';
};

type GroupedWarning = {
  aircraftId: string;
  aircraftName: string;
  isOutOfService: boolean;
  warnings: WarningMessage[];
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
  
  const groupedMaintenanceWarnings = useMemo<GroupedWarning[]>(() => {
    if (anyLoading || anyError) return [];

    const groupedWarnings: GroupedWarning[] = [];
    const today = startOfDay(new Date());

    aircraftWithCalculatedData.forEach(ac => {
        const warnings: WarningMessage[] = [];

        const isAnnualExpired = ac.annual_review_date ? isBefore(parseISO(ac.annual_review_date), today) : false;
        const isInsuranceExpired = ac.insurance_expiry_date ? isBefore(parseISO(ac.insurance_expiry_date), today) : false;
        
        const isEffectivelyOutOfService = ac.is_out_of_service || isAnnualExpired || isInsuranceExpired;

        // Add warning for manual out of service, ONLY if it's not already out for expired dates
        if (ac.is_out_of_service && !isAnnualExpired && !isInsuranceExpired) {
             warnings.push({
                message: ac.out_of_service_reason || 'Marcado como Fuera de Servicio sin motivo específico.',
                severity: 'critical',
            });
        }

        // Check annual review
        if (ac.annual_review_date && isValid(parseISO(ac.annual_review_date))) {
            const reviewDate = parseISO(ac.annual_review_date);
            if (isAnnualExpired) {
                warnings.push({
                    message: `Revisión Anual VENCIDA el ${format(reviewDate, 'dd/MM/yyyy', { locale: es })}`,
                    severity: 'critical',
                });
            } else {
                const daysDiff = differenceInDays(reviewDate, today);
                if (daysDiff <= 30) {
                    warnings.push({
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
                    message: `Seguro VENCIDO el ${format(expiryDate, 'dd/MM/yyyy', { locale: es })}`,
                    severity: 'critical',
                });
            } else {
                const daysDiff = differenceInDays(expiryDate, today);
                if (daysDiff <= 30) {
                     warnings.push({
                        message: `Seguro vence en ${daysDiff} día(s)`,
                        severity: 'warning',
                    });
                }
            }
        }

        // Check oil hours
        if (ac.hours_since_oil_change !== null && ac.hours_since_oil_change >= 20) {
            warnings.push({
                message: `Requiere cambio de aceite (${ac.hours_since_oil_change.toFixed(1)} hs acumuladas)`,
                severity: 'warning',
            });
        }
        
        if (warnings.length > 0) {
            groupedWarnings.push({
                aircraftId: ac.id,
                aircraftName: ac.name,
                isOutOfService: isEffectivelyOutOfService,
                warnings: warnings
            });
        }
    });

    return groupedWarnings.sort((a, b) => {
      if (a.isOutOfService && !b.isOutOfService) return -1;
      if (!a.isOutOfService && b.isOutOfService) return 1;
      return a.aircraftName.localeCompare(b.aircraftName);
    });
  }, [aircraftWithCalculatedData, anyLoading, anyError]);

  if (anyLoading || anyError || groupedMaintenanceWarnings.length === 0) {
    return null; // Don't render anything if loading, error, or no warnings
  }

  return (
    <Card className="mb-6 shadow-md">
        <CardHeader>
            <CardTitle className="text-lg">
                Avisos de Mantenimiento y Estado
            </CardTitle>
            <CardDescription>
                Las siguientes aeronaves requieren atención. <Link href="/aircraft" className="underline hover:text-primary font-semibold">Ir a Aeronaves</Link> para más detalles.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {groupedMaintenanceWarnings.map(group => {
                const isCritical = group.isOutOfService;
                return (
                    <Card key={group.aircraftId} className={cn(isCritical ? 'border-destructive bg-destructive/10' : 'border-blue-400 bg-blue-50')}>
                        <CardHeader className="p-4">
                            <CardTitle className={cn("text-base flex items-center", isCritical ? 'text-destructive' : 'text-blue-800')}>
                                {isCritical ? <AlertTriangle className="mr-2 h-4 w-4" /> : <Info className="mr-2 h-4 w-4" />}
                                {group.aircraftName} - {isCritical ? 'Fuera de Servicio' : 'Requiere Atención'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-sm">
                            <ul className="list-disc pl-5 space-y-1">
                                {group.warnings.map((warning, index) => (
                                    <li key={index} className={cn(warning.severity === 'critical' ? 'font-semibold text-destructive' : 'text-blue-900')}>
                                        {warning.message}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                );
            })}
        </CardContent>
    </Card>
  );
}
