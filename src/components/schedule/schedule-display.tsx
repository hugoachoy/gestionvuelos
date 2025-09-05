
"use client";

import type { ScheduleEntry, Pilot, PilotCategory, Aircraft } from '@/types'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Clock, AlertTriangle, User, Plane, CheckCircle, XCircle } from 'lucide-react';
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface GroupedEntries {
    remolcadores: ScheduleEntry[];
    instructoresAvion: ScheduleEntry[];
    instructoresPlaneador: ScheduleEntry[];
    pilotosAvion: ScheduleEntry[];
    pilotosPlaneador: ScheduleEntry[];
}

interface ScheduleDisplayProps {
  groupedEntries: GroupedEntries;
  onEdit: (entry: ScheduleEntry) => void;
  onDelete: (entry: ScheduleEntry) => void;
}

const PilotListItem: React.FC<{ entry: ScheduleEntry, onEdit: (entry: ScheduleEntry) => void, onDelete: (entry: ScheduleEntry) => void }> = ({ entry, onEdit, onDelete }) => {
    const { getPilotName, pilots } = usePilotsStore();
    const { getAircraftName } = useAircraftStore();
    const { user: currentUser } = useAuth();
    
    const pilot = pilots.find(p => p.id === entry.pilot_id);
    let medicalWarning = null;
    
    if (pilot && pilot.medical_expiry) {
        const medicalExpiryDate = parseISO(pilot.medical_expiry);
        const entryDate = parseISO(entry.date);
        
        if (isValid(medicalExpiryDate) && isValid(entryDate)) {
            const isExpired = isBefore(startOfDay(medicalExpiryDate), startOfDay(entryDate));
            if (isExpired) {
                medicalWarning = `PF VENCIDO (${format(medicalExpiryDate, "dd/MM/yy", { locale: es })})`;
            }
        }
    }
    
    const isOwner = currentUser && entry.auth_user_id && currentUser.id === entry.auth_user_id;
    const canManageEntry = isOwner || currentUser?.is_admin;
    const aircraftName = entry.aircraft_id ? getAircraftName(entry.aircraft_id) : null;

    return (
        <div className="flex items-center justify-between p-2 border-b last:border-b-0">
            <div className="flex flex-col">
                <span className="font-medium text-foreground">
                    {getPilotName(entry.pilot_id)}
                    {aircraftName && <span className="text-muted-foreground font-normal"> en {aircraftName}</span>}
                </span>
                <span className="text-xs text-muted-foreground">Disponible desde: {entry.start_time.substring(0, 5)} hs</span>
                 {medicalWarning && (
                    <Badge variant="destructive" className="mt-1 w-fit">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {medicalWarning}
                    </Badge>
                )}
            </div>
            {canManageEntry && (
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(entry)} className="h-8 w-8 hover:text-primary">
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(entry)} className="h-8 w-8 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};


const GroupCard: React.FC<{ title: string; entries: ScheduleEntry[]; icon: React.ReactNode; onEdit: (entry: ScheduleEntry) => void; onDelete: (entry: ScheduleEntry) => void; }> = ({ title, entries, icon, onEdit, onDelete }) => {
    if (entries.length === 0) return null;
    
    return (
        <Card>
            <CardHeader className="p-4 bg-muted/50 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {entries.map(entry => (
                    <PilotListItem key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
                ))}
            </CardContent>
        </Card>
    );
};


export function ScheduleDisplay({ groupedEntries, onEdit, onDelete }: ScheduleDisplayProps) {
  const { remolcadores, instructoresAvion, instructoresPlaneador, pilotosAvion, pilotosPlaneador } = groupedEntries;

  const hasAnyEntries = [remolcadores, instructoresAvion, instructoresPlaneador, pilotosAvion, pilotosPlaneador].some(group => group.length > 0);

  if (!hasAnyEntries) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No hay turnos para la fecha seleccionada.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4 mt-6">
        <GroupCard 
            title="Remolcadores"
            entries={remolcadores}
            icon={<Plane className="h-5 w-5 text-primary" />}
            onEdit={onEdit}
            onDelete={onDelete}
        />
         <GroupCard 
            title="Instructores de Avión"
            entries={instructoresAvion}
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            onEdit={onEdit}
            onDelete={onDelete}
        />
         <GroupCard 
            title="Instructores de Planeador"
            entries={instructoresPlaneador}
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            onEdit={onEdit}
            onDelete={onDelete}
        />
        <GroupCard 
            title="Pilotos de Avión"
            entries={pilotosAvion}
            icon={<User className="h-5 w-5 text-muted-foreground" />}
            onEdit={onEdit}
            onDelete={onDelete}
        />
        <GroupCard 
            title="Pilotos de Planeador"
            entries={pilotosPlaneador}
            icon={<User className="h-5 w-5 text-muted-foreground" />}
            onEdit={onEdit}
            onDelete={onDelete}
        />
    </div>
  );
}
