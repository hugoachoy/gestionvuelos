
"use client";

import React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { AvailabilityForm } from '@/components/schedule/availability-form';
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
import type { ScheduleEntry } from '@/types'; // PilotCategory removed as it's not directly used in this file's top level
import { FLIGHT_TYPES } from '@/types';
import { PlusCircle, CalendarIcon, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UnderlineKeywords } from '@/components/common/underline-keywords';

const LAST_CLEANUP_KEY = 'lastScheduleCleanup';

export function ScheduleClient() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
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

  // Set initial date on client-side to prevent hydration mismatch for selectedDate
  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

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
      observationTextareaRef.current.style.height = 'auto'; // Reset height to recalculate
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
          console.log("Running daily schedule cleanup...");
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
    if (entryToDelete && selectedDate) { // ensure selectedDate is available for refetch
      await removeEntry(entryToDelete.id, format(selectedDate, 'yyyy-MM-dd'));
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
    if (!selectedDate || !scheduleEntries || categoriesLoading || !categories || !categories.length) return [];
    
    const instructorCategory = categories.find(c => c.name === 'Instructor');
    const remolcadorCategory = categories.find(c => c.name === 'Remolcador');

    return [...scheduleEntries]
      .sort((a, b) => {
        const aIsInstructor = a.pilot_category_id === instructorCategory?.id;
        const bIsInstructor = b.pilot_category_id === instructorCategory?.id;
        const aIsRemolcador = a.pilot_category_id === remolcadorCategory?.id;
        const bIsRemolcador = b.pilot_category_id === remolcadorCategory?.id;
        const aIsConfirmedTow = aIsRemolcador && a.is_tow_pilot_available === true;
        const bIsConfirmedTow = bIsRemolcador && b.is_tow_pilot_available === true;

        // 1. Instructor Pilots
        if (aIsInstructor && !bIsInstructor) return -1;
        if (!aIsInstructor && bIsInstructor) return 1;
        if (aIsInstructor && bIsInstructor) {
          return a.start_time.localeCompare(b.start_time);
        }
        
        // 2. Confirmed Tow Pilots (Category: Remolcador, Available: true)
        if (aIsConfirmedTow && !bIsConfirmedTow) return -1;
        if (!aIsConfirmedTow && bIsConfirmedTow) return 1;
        if (aIsConfirmedTow && bIsConfirmedTow) {
          return a.start_time.localeCompare(b.start_time);
        }
        
        // 3. Unconfirmed/Unavailable Tow Pilots (Category: Remolcador, Available: false/undefined)
        if (aIsRemolcador && !bIsRemolcador) return -1;
        if (!aIsRemolcador && bIsRemolcador) return 1;
        if (aIsRemolcador && bIsRemolcador) { 
          return a.start_time.localeCompare(b.start_time);
        }

        // 4. Other Pilots: Group by aircraft, then time, then sport preference.
        const aHasAircraft = !!a.aircraft_id;
        const bHasAircraft = !!b.aircraft_id;

        if (aHasAircraft && !bHasAircraft) return -1;
        if (!aHasAircraft && bHasAircraft) return 1;
        
        if (aHasAircraft && bHasAircraft && a.aircraft_id && b.aircraft_id) {
            const aircraftComparison = (a.aircraft_id).localeCompare(b.aircraft_id);
            if (aircraftComparison !== 0) return aircraftComparison;
        }

        const timeComparison = a.start_time.localeCompare(b.start_time);
        if (timeComparison !== 0) return timeComparison;

        const aIsSport = a.flight_type_id === 'sport';
        const bIsSport = b.flight_type_id === 'sport';
        if (aIsSport && !bIsSport) return -1; // Sport flights first
        if (!aIsSport && bIsSport) return 1;
        
        return 0;
      });
  }, [selectedDate, scheduleEntries, categories, categoriesLoading]);


  const handleRefreshAll = useCallback(() => {
    fetchPilots();
    fetchCategories();
    fetchAircrafts();
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetchScheduleEntries(dateStr);
      fetchObservations(dateStr);
    } else { // If no date is selected yet (e.g., initial load before client-side effect sets it)
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        fetchScheduleEntries(todayStr); // Fetch for today by default
        fetchObservations(todayStr);
    }
  }, [selectedDate, fetchPilots, fetchCategories, fetchAircrafts, fetchScheduleEntries, fetchObservations]);

  const anyLoading = pilotsLoading || categoriesLoading || aircraftLoading || scheduleLoading || obsLoading;
  const anyError = pilotsError || categoriesError || aircraftError || scheduleError || obsError;

  const isTowPilotCategoryConfirmed = useMemo(() => {
    if (anyLoading || !categories || !categories.length || !scheduleEntries || !selectedDate) {
        return false; 
    }
    const towPilotCategory = categories.find(cat => cat.name === 'Remolcador');
    if (!towPilotCategory) {
      return true; // If category doesn't exist, don't show warning for it
    }
    return scheduleEntries.some(entry =>
      entry.pilot_category_id === towPilotCategory.id &&
      entry.is_tow_pilot_available === true 
    );
  }, [scheduleEntries, categories, anyLoading, selectedDate]);

  const isInstructorConfirmed = useMemo(() => {
    if (anyLoading || !categories || !categories.length || !scheduleEntries || !selectedDate) {
      return false;
    }
    const instructorCategory = categories.find(cat => cat.name === 'Instructor');
    if (!instructorCategory) {
      return true; // If category doesn't exist, don't show warning for it
    }
    return scheduleEntries.some(entry => entry.pilot_category_id === instructorCategory.id);
  }, [scheduleEntries, categories, anyLoading, selectedDate]);


  const towageFlightTypeId = useMemo(() => {
    return FLIGHT_TYPES.find(ft => ft.name === 'Remolque')?.id;
  }, []);

  const noTowageFlightsPresent = useMemo(() => {
    if (!selectedDate || scheduleLoading || !towageFlightTypeId || !scheduleEntries) {
      return false;
    }
    return !scheduleEntries.some(entry => entry.flight_type_id === towageFlightTypeId);
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
                  variant={"default"}
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal",
                    !selectedDate && "text-primary-foreground/70" 
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
       !anyLoading && // Only show if not loading
       categories.some(cat => cat.name === 'Remolcador') && // Only if "Remolcador" category is defined
        <Alert variant="destructive" className="mb-6 shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <UnderlineKeywords text='Aún no hay piloto de categoría "Remolcador" confirmado para esta fecha.' />
          </AlertDescription>
        </Alert>
      }

      {selectedDate &&
       !isInstructorConfirmed && 
       !anyLoading && // Only show if not loading
       categories.some(cat => cat.name === 'Instructor') && // Only if "Instructor" category is defined
        <Alert variant="default" className="mb-6 shadow-sm border-orange-400 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <strong className="text-orange-700">
                <UnderlineKeywords text='Aún no hay "Instructor" confirmado para esta fecha.' />
            </strong>
          </AlertDescription>
        </Alert>
      }

      {selectedDate &&
       noTowageFlightsPresent && 
       towageFlightTypeId && // Ensure towage type ID is found
       !anyLoading && // Only show if not loading
        <Alert variant="default" className="mb-6 shadow-sm border-orange-400 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <strong className="text-orange-700">
                <UnderlineKeywords text='Aún no hay "Remolcador" confirmado para esta fecha.' />
            </strong>
          </AlertDescription>
        </Alert>
      }

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
