
"use client";

import type { ScheduleEntry } from '@/types'; 
import { FLIGHT_TYPES } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plane, Clock, Layers, CheckCircle2, XCircle, Award, BookOpen, AlertTriangle, PlaneTakeoff, PlaneLanding } from 'lucide-react';
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { format, parseISO, differenceInDays, isBefore, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ScheduleDisplayProps {
  entries: ScheduleEntry[];
  onEdit: (entry: ScheduleEntry) => void;
  onDelete: (entry: ScheduleEntry) => void;
}

const FlightTypeIcon: React.FC<{ typeId: typeof FLIGHT_TYPES[number]['id'] }> = ({ typeId }) => {
  switch (typeId) {
    case 'sport': return <Award className="h-4 w-4 text-yellow-500" />;
    case 'instruction': return <BookOpen className="h-4 w-4 text-blue-500" />;
    case 'local': return <PlaneLanding className="h-4 w-4 text-green-500" />;
    case 'towage': return <PlaneTakeoff className="h-4 w-4 text-sky-500" />;
    default: return null;
  }
};

export function ScheduleDisplay({ entries, onEdit, onDelete }: ScheduleDisplayProps) {
  const { getPilotName, pilots } = usePilotsStore(); 
  const { getCategoryName } = usePilotCategoriesStore();
  const { getAircraftName } = useAircraftStore();

  if (entries.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No hay turnos para la fecha seleccionada.</p>
        </CardContent>
      </Card>
    );
  }
  
  const getFlightTypeName = (id: typeof FLIGHT_TYPES[number]['id']) => FLIGHT_TYPES.find(ft => ft.id === id)?.name || 'Desconocido';

  return (
    <div className="space-y-4 mt-6">
      {entries.map((entry) => {
        const pilot = pilots.find(p => p.id === entry.pilot_id);
        let expiringBadge = null;
        let expiredBlock = null;
        const displayTime = entry.start_time.substring(0, 5); // HH:MM
        const pilotCategoryName = getCategoryName(entry.pilot_category_id);

        if (pilot && pilot.medical_expiry) {
          const medicalExpiryDate = parseISO(pilot.medical_expiry);
          const entryDate = parseISO(entry.date); 
          
          if (isValid(medicalExpiryDate) && isValid(entryDate)) {
            const today = new Date();
            const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            const isExpiredOnEntryDate = isBefore(medicalExpiryDate, entryDate);
            const daysUntilExpiryFromToday = differenceInDays(medicalExpiryDate, todayNormalized);

            if (isExpiredOnEntryDate) {
              expiredBlock = (
                <div className="mt-1 text-xs font-medium text-destructive-foreground bg-destructive p-1 px-2 rounded inline-flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  PF VENCIDO ({format(medicalExpiryDate, "dd/MM/yy", { locale: es })})
                </div>
              );
            } else { // Not expired on entry date, check for upcoming expiry from today
              if (daysUntilExpiryFromToday <= 30) {
                expiringBadge = (
                  <Badge variant="destructive" className="ml-2 text-xs shrink-0">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Psicofísico vence {format(medicalExpiryDate, "dd/MM/yy", { locale: es })} (en {daysUntilExpiryFromToday} días)
                  </Badge>
                );
              } else if (daysUntilExpiryFromToday <= 60) {
                expiringBadge = (
                  <Badge className="ml-2 text-xs shrink-0 bg-yellow-400 text-black hover:bg-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Psicofísico vence {format(medicalExpiryDate, "dd/MM/yy", { locale: es })} (en {daysUntilExpiryFromToday} días)
                  </Badge>
                );
              }
            }
          }
        }
        
        const isTowageRelated = pilotCategoryName === 'Piloto remolcador' || entry.flight_type_id === 'towage';

        return (
          <Card 
            key={entry.id} 
            className={cn(
              "shadow-md hover:shadow-lg transition-shadow",
              isTowageRelated && 'bg-primary/20' // Increased opacity
            )}
          >
            <CardHeader className="pb-2">
               <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center flex-wrap">
                    <Clock className="h-5 w-5 mr-2 text-primary shrink-0" />
                    <span className="mr-1">{displayTime} - {getPilotName(entry.pilot_id)}</span>
                    {expiringBadge}
                  </CardTitle>
                  {expiredBlock}
                  <CardDescription className="flex items-center gap-2 mt-1 pt-1">
                    <Layers className="h-4 w-4 text-muted-foreground" /> {pilotCategoryName}
                    <FlightTypeIcon typeId={entry.flight_type_id} /> {getFlightTypeName(entry.flight_type_id)}
                  </CardDescription>
                </div>
                <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(entry)} className="hover:text-primary">
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(entry)} className="hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1 pt-2">
              {entry.aircraft_id && (
                <div className="flex items-center">
                  <Plane className="h-4 w-4 mr-2" /> Aeronave: {getAircraftName(entry.aircraft_id)}
                </div>
              )}
              {pilotCategoryName === 'Piloto remolcador' && (
                <div className="flex items-center">
                  {!!entry.is_tow_pilot_available ? 
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> : 
                    <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                  Remolcador: {!!entry.is_tow_pilot_available ? 'Disponible' : 'No Disponible'}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

