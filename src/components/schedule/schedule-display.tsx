
"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft, FlightType } from '@/types';
import { FLIGHT_TYPES } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plane, User, Clock, Layers, CheckCircle2, XCircle, Award, BookOpen, MapPin } from 'lucide-react';
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';

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
  const { getPilotName } = usePilotsStore();
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
      {entries.map((entry) => (
        <Card key={entry.id} className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
             <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-primary" />
                  {entry.startTime} - {getPilotName(entry.pilotId)}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Layers className="h-4 w-4 text-muted-foreground" /> {getCategoryName(entry.pilotCategoryId)}
                  <FlightTypeIcon typeId={entry.flightTypeId} /> {getFlightTypeName(entry.flightTypeId)}
                </CardDescription>
              </div>
              <div className="flex gap-1">
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
          <CardContent className="text-sm text-muted-foreground space-y-1">
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
      ))}
    </div>
  );
}
