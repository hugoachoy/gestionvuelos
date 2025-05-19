
"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft, FlightType } from '@/types';
import { FLIGHT_TYPES } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plane, Clock, Layers, CheckCircle2, XCircle, Award, BookOpen, MapPin, AlertTriangle } from 'lucide-react';
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { format, parseISO, differenceInDays, isBefore, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface ScheduleDisplayProps {
  entries: ScheduleEntry[];
  onEdit: (entry: ScheduleEntry) => void;
  onDelete: (entry: ScheduleEntry) => void;
}

const FlightTypeIcon: React.FC<{ typeId: FlightType['id'] }> = ({ typeId }) => {
  switch (typeId) {
    case 'sport': return <Award className="h-4 w-4 text-yellow-500" />;
    case 'instruction': return <BookOpen className="h-4 w-4 text-blue-500" />;
    case 'local': return <MapPin className="h-4 w-4 text-green-500" />;
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
  
  const getFlightTypeName = (id: FlightType['id']) => FLIGHT_TYPES.find(ft => ft.id === id)?.name || 'Desconocido';

  return (
    <div className="space-y-4 mt-6">
      {entries.map((entry) => {
        const pilot = pilots.find(p => p.id === entry.pilotId);
        let medicalWarningElement = null;

        if (pilot && pilot.medicalExpiry) {
          const medicalExpiryDate = parseISO(pilot.medicalExpiry);
          if (isValid(medicalExpiryDate)) {
            const today = new Date();
            const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // Today at 00:00:00

            const isExpired = isBefore(medicalExpiryDate, todayNormalized);
            const daysUntilExpiry = differenceInDays(medicalExpiryDate, todayNormalized);

            if (isExpired) {
              medicalWarningElement = (
                <Badge variant="destructive" className="ml-2 text-xs shrink-0">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Psicofísico VENCIDO ({format(medicalExpiryDate, "dd/MM/yy", { locale: es })})
                </Badge>
              );
            } else if (daysUntilExpiry <= 30) {
              medicalWarningElement = (
                <Badge variant="default" className="ml-2 text-xs shrink-0">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Psicofísico vence {format(medicalExpiryDate, "dd/MM/yy", { locale: es })} (en {daysUntilExpiry} días)
                </Badge>
              );
            }
          } else {
            console.warn(`Invalid medical expiry date for pilot ${pilot.id}: ${pilot.medicalExpiry}`);
          }
        }

        return (
          <Card key={entry.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
               <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center flex-wrap">
                    <Clock className="h-5 w-5 mr-2 text-primary shrink-0" />
                    <span className="mr-1">{entry.startTime} - {getPilotName(entry.pilotId)}</span>
                    {medicalWarningElement}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Layers className="h-4 w-4 text-muted-foreground" /> {getCategoryName(entry.pilotCategoryId)}
                    <FlightTypeIcon typeId={entry.flightTypeId} /> {getFlightTypeName(entry.flightTypeId)}
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
              {entry.aircraftId && (
                <div className="flex items-center">
                  <Plane className="h-4 w-4 mr-2" /> Aeronave: {getAircraftName(entry.aircraftId)}
                </div>
              )}
              {getCategoryName(entry.pilotCategoryId) === 'Piloto remolcador' && (
                <div className="flex items-center">
                  {!!entry.isTowPilotAvailable ? 
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> : 
                    <XCircle className="h-4 w-4 mr-2 text-red-500" />}
                  Remolcador Disponible: {!!entry.isTowPilotAvailable ? 'Sí' : 'No'}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
