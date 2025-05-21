
"use client";

import React from 'react'; 
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { AvailabilityForm, type AvailabilityFormData } from '@/components/schedule/availability-form';
import { ScheduleDisplay } from '@/components/schedule/schedule-display';
import { ShareButton } from '@/components/schedule/share-button';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { 
  usePilotsStore, 
  usePilotCategoriesStore, 
  useAircraftStore, 
  useScheduleStore, 
  useDailyObservationsStore 
} from '@/store/data-hooks';
import type { ScheduleEntry } from '@/types';
import { FLIGHT_TYPES } from '@/types'; 
import { PlusCircle, CalendarIcon, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from "@/components/ui/alert";

const LAST_CLEANUP_KEY = 'lastScheduleCleanup';

export function ScheduleClient() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();
  
  const { pilots, loading: pilotsLoading, error: pilotsError, fetchPilots } = usePilotsStore();
  const { categories, loading: categoriesLoading, error: categoriesError, fetchCategories } = usePilotCategoriesStore();
  const { aircraft, loading: aircraftLoading, error: aircraftError, fetchAircraft: fetchAircrafts } = useAircraftStore();
  const { scheduleEntries, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry: removeEntry, loading: scheduleLoading, error: scheduleError, fetchScheduleEntries, cleanupOldScheduleEntries } = useScheduleStore();
  const { getObservation, updateObservation, loading: obsLoading, error: obsError, fetchObservations } = useDailyObservationsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
  
  const [observationInput, setObservationInput] = useState('');
  const observationTextareaRef = useRef<HTMLTextAreaElement>(null);

  const formattedSelectedDate = useMemo(() => {
    return selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  }, [selectedDate]);

   useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetchScheduleEntries(dateStr);
      fetchObservations(dateStr);
    }
  }, [selectedDate, fetchScheduleEntries, fetchObservations]);

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

  useEffect(() => {
    const runCleanup = async () => {
      if (typeof window !== 'undefined') { 
        const lastCleanupTimestamp = localStorage.getItem(LAST_CLEANUP_KEY);
        const now = new Date().getTime();
        const oneDayInMs = 24 * 60 * 60 * 1000;

        if (!lastCleanupTimestamp || (now - parseInt(lastCleanupTimestamp, 10)) > oneDayInMs) {
          console.log("Performing scheduled cleanup of old entries...");
          const result = await cleanupOldScheduleEntries();
          if (result.success && result.count > 0) {
            toast({
              title: "Limpieza de Agenda",
              description: `${result.count} turnos antiguos han sido eliminados.`,
            });
          } else if (!result.success && result.error) {
             console.error("Failed to cleanup old entries:", result.error);
          }
          localStorage.setItem(LAST_CLEANUP_KEY, now.toString());
        }
      }
    };
    runCleanup();
  }, [cleanupOldScheduleEntries, toast]); 


  const handleSaveObservation = async () => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await updateObservation(dateStr, observationInput);
      toast({ title: "Observaciones guardadas", description: "Las observaciones para el día han sido guardadas." });
    }
  };

  const handleAddEntry = () => {
    setEditingEntry(undefined);
    setIsFormOpen(true);
  };

  const handleEditEntry = (entry: ScheduleEntry) => {
    setEditingEntry(entry);
    setIsFormOpen(true);
  };

  const handleDeleteEntry = (entry: ScheduleEntry) => {
    setEntryToDelete(entry);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (entryToDelete) {
      await removeEntry(entryToDelete.id, entryToDelete.date);
    }
    setIsDeleteDialogOpen(false);
    setEntryToDelete(null);
  };

  const handleSubmitForm = async (data: Omit<ScheduleEntry, 'id' | 'created_at'>, entryId?: string) => {
    if (entryId) {
      await updateScheduleEntry({ ...data, id: entryId });
    } else {
      await addScheduleEntry(data);
    }
    setIsFormOpen(false);
  };

  const filteredAndSortedEntries = useMemo(() => {
    if (!selectedDate || !scheduleEntries) return [];

    const towPilotCategory = categories.find(c => c.name === 'Remolcador');
    const instructorCategory = categories.find(c => c.name === 'Instructor');

    return [...scheduleEntries]
      .sort((a, b) => {
        const aIsActualTowPilotCategory = a.pilot_category_id === towPilotCategory?.id;
        const bIsActualTowPilotCategory = b.pilot_category_id === towPilotCategory?.id;

        const aIsConfirmedTowPilot = aIsActualTowPilotCategory && a.is_tow_pilot_available === true;
        const bIsConfirmedTowPilot = bIsActualTowPilotCategory && b.is_tow_pilot_available === true;

        if (aIsConfirmedTowPilot && !bIsConfirmedTowPilot) return -1;
        if (!aIsConfirmedTowPilot && bIsConfirmedTowPilot) return 1;
        if (aIsConfirmedTowPilot && bIsConfirmedTowPilot) {
          return a.start_time.localeCompare(b.start_time);
        }
        
        const aIsUnconfirmedTowPilot = aIsActualTowPilotCategory && (a.is_tow_pilot_available === false || a.is_tow_pilot_available === undefined); 
        const bIsUnconfirmedTowPilot = bIsActualTowPilotCategory && (b.is_tow_pilot_available === false || b.is_tow_pilot_available === undefined);
        
        if (aIsUnconfirmedTowPilot && !bIsUnconfirmedTowPilot) return -1;
        if (!aIsUnconfirmedTowPilot && bIsUnconfirmedTowPilot) return 1;
        if (aIsUnconfirmedTowPilot && bIsUnconfirmedTowPilot) {
            return a.start_time.localeCompare(b.start_time);
        }

        const aIsInstructor = a.pilot_category_id === instructorCategory?.id;
        const bIsInstructor = b.pilot_category_id === instructorCategory?.id;

        if (aIsInstructor && !bIsInstructor) return -1;
        if (!aIsInstructor && bIsInstructor) return 1;
        if (aIsInstructor && bIsInstructor) {
          return a.start_time.localeCompare(b.start_time);
        }

        const aIsSport = a.flight_type_id === 'sport';
        const bIsSport = b.flight_type_id === 'sport';

        if (aIsSport && !bIsSport) return -1;
        if (!aIsSport && bIsSport) return 1;
        
        return a.start_time.localeCompare(b.start_time);
      });
  }, [selectedDate, scheduleEntries, categories]);
  
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
  }, [selectedDate]);

  const handleRefreshAll = useCallback(() => {
    fetchPilots();
    fetchCategories();
    fetchAircrafts();
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetchScheduleEntries(dateStr);
      fetchObservations(dateStr);
    } else {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        fetchScheduleEntries(todayStr); 
        fetchObservations(todayStr);
    }
  }, [selectedDate, fetchPilots, fetchCategories, fetchAircrafts, fetchScheduleEntries, fetchObservations]);

  const anyLoading = pilotsLoading || categoriesLoading || aircraftLoading || scheduleLoading || obsLoading;
  const anyError = pilotsError || categoriesError || aircraftError || scheduleError || obsError;

  const isTowPilotCategoryConfirmed = useMemo(() => {
    if (categoriesLoading || scheduleLoading || !categories || !categories.length || !scheduleEntries) {
        return false; 
    }
    const towPilotCategory = categories.find(cat => cat.name === 'Remolcador');
    if (!towPilotCategory) { 
      return false; 
    }
    return scheduleEntries.some(entry => 
      entry.pilot_category_id === towPilotCategory.id &&
      entry.is_tow_pilot_available === true
    );
  }, [scheduleEntries, categories, categoriesLoading, scheduleLoading]);

  const towageFlightTypeId = useMemo(() => {
    return FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;
  }, []);

  const noTowageFlightsPresent = useMemo(() => {
    if (!selectedDate || scheduleLoading || !towageFlightTypeId || !scheduleEntries) {
      return false; 
    }
    if (scheduleEntries.length === 0) {
      return true; 
    }
    return scheduleEntries.every(entry => entry.flight_type_id !== towageFlightTypeId);
  }, [selectedDate, scheduleEntries, scheduleLoading, towageFlightTypeId]);


  if (anyError) {
    return (
      <div className="text-destructive p-4">
        Error al cargar datos: {anyError.message || JSON.stringify(anyError)}
        <Button onClick={handleRefreshAll} className="ml-2 mt-2">Reintentar Cargar Todo</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader 
        title="Agenda de Vuelos"
        action={
          <div className="flex gap-2">
            <Button onClick={handleRefreshAll} variant="outline" size="icon" disabled={anyLoading}>
              <RefreshCw className={cn("h-4 w-4", anyLoading && "animate-spin")} />
            </Button>
            {selectedDate && (filteredAndSortedEntries.length > 0 || (savedObservationText && savedObservationText.trim() !== '')) && (
              <ShareButton 
                scheduleDate={selectedDate} 
                entries={filteredAndSortedEntries} 
                observationText={savedObservationText}
              />
            )}
            <Button onClick={handleAddEntry} disabled={!selectedDate || anyLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Turno
            </Button>
          </div>
        }
      />

      <Card className="mb-6 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <p className="font-medium">Seleccionar fecha:</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  disabled={anyLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  locale={es}
                  disabled={anyLoading}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className="mb-6 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Observaciones del Día</CardTitle>
          </CardHeader>
          <CardContent>
            {obsLoading && !observationInput && !savedObservationText ? <Skeleton className="h-10 w-full" /> : ( 
              <Textarea
                ref={observationTextareaRef}
                placeholder="Escribe observaciones generales para la agenda de este día..."
                value={observationInput}
                onChange={(e) => setObservationInput(e.target.value)}
                rows={1} 
                className="mb-3 resize-none overflow-hidden" 
                disabled={obsLoading}
              />
            )}
            <Button onClick={handleSaveObservation} size="sm" disabled={obsLoading}>
              <Save className="mr-2 h-4 w-4" />
              Guardar Observaciones
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedDate && 
       !isTowPilotCategoryConfirmed && 
       categories && categories.find(cat => cat.name === 'Remolcador') && 
       !anyLoading && 
        <Alert variant="destructive" className="mb-6 shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Aún no hay piloto remolcador confirmado para esta fecha.
          </AlertDescription>
        </Alert>
      }
      
      {selectedDate &&
       noTowageFlightsPresent && 
       towageFlightTypeId &&    
       !anyLoading && (
        <Alert variant="default" className="mb-6 shadow-sm border-orange-400 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <strong className="text-orange-700">Aún no hay Remolcador confirmado</strong>
          </AlertDescription>
        </Alert>
      )}

      {scheduleLoading && !filteredAndSortedEntries.length ? (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : selectedDate && (
        <ScheduleDisplay 
          entries={filteredAndSortedEntries}
          onEdit={handleEditEntry}
          onDelete={handleDeleteEntry}
        />
      )}

      <AvailabilityForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitForm}
        entry={editingEntry}
        pilots={pilots}
        categories={categories}
        aircraft={aircraft}
        selectedDate={selectedDate}
        existingEntries={scheduleEntries} 
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={entryToDelete ? `el turno de las ${entryToDelete.start_time.substring(0,5)}` : 'este turno'}
      />
    </>
  );
}
