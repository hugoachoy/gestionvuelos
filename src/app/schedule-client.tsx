
"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'; // Added useRef
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
import { PlusCircle, CalendarIcon, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ScheduleClient() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();
  
  const { pilots, loading: pilotsLoading, error: pilotsError, fetchPilots } = usePilotsStore();
  const { categories, getCategoryName, loading: categoriesLoading, error: categoriesError, fetchCategories } = usePilotCategoriesStore();
  const { aircraft, loading: aircraftLoading, error: aircraftError, fetchAircraft: fetchAircrafts } = useAircraftStore();
  const { scheduleEntries, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry: removeEntry, loading: scheduleLoading, error: scheduleError, fetchScheduleEntries } = useScheduleStore();
  const { getObservation, updateObservation, loading: obsLoading, error: obsError, fetchObservations } = useDailyObservationsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
  
  const [observationInput, setObservationInput] = useState('');
  const observationTextareaRef = useRef<HTMLTextAreaElement>(null); // Ref for the textarea

  const formattedSelectedDate = useMemo(() => {
    return selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  }, [selectedDate]);

   // Effect for fetching schedule and observation data when selectedDate changes
   useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetchScheduleEntries(dateStr);
      fetchObservations(dateStr);
    }
  }, [selectedDate, fetchScheduleEntries, fetchObservations]);


  // Memoize observation text for the selected date
  const savedObservationText = useMemo(() => {
    return formattedSelectedDate ? getObservation(formattedSelectedDate) : undefined;
  }, [formattedSelectedDate, getObservation]);

  // Effect for setting local observationInput state when observation from store changes
  useEffect(() => {
    setObservationInput(savedObservationText || '');
  }, [savedObservationText]);

  // Effect for auto-resizing the textarea
  useEffect(() => {
    if (observationTextareaRef.current) {
      observationTextareaRef.current.style.height = 'auto'; // Reset height to allow shrinkage
      observationTextareaRef.current.style.height = `${observationTextareaRef.current.scrollHeight}px`;
    }
  }, [observationInput]);


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
    if (!selectedDate) return [];
    
    const categoryOrderValues: Record<string, number> = {
      'Piloto remolcador': 1,
      'Instructor': 2,
    };

    return [...scheduleEntries] 
      .sort((a, b) => {
        const catA_Name = getCategoryName(a.pilot_category_id);
        const catB_Name = getCategoryName(b.pilot_category_id);

        const orderA = categoryOrderValues[catA_Name] || 3; 
        const orderB = categoryOrderValues[catB_Name] || 3;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        if (catA_Name === 'Piloto remolcador') {
          // Prioritize available tow pilots if category is the same
          if (a.is_tow_pilot_available && !b.is_tow_pilot_available) return -1;
          if (!a.is_tow_pilot_available && b.is_tow_pilot_available) return 1;
        }
        
        const isSportA = a.flight_type_id === 'sport';
        const isSportB = b.flight_type_id === 'sport';

        if (isSportA && !isSportB) return -1;
        if (!isSportA && isSportB) return 1;

        return a.start_time.localeCompare(b.start_time);
      });
  }, [selectedDate, scheduleEntries, getCategoryName]);
  
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

  const isTowPilotConfirmed = useMemo(() => {
    if (!selectedDate || !scheduleEntries.length || !categories.length) {
      return false; 
    }
    const towPilotCategory = categories.find(cat => cat.name === 'Piloto remolcador');
    if (!towPilotCategory) return true; 

    return scheduleEntries.some(entry => 
      entry.date === formattedSelectedDate &&
      entry.pilot_category_id === towPilotCategory.id &&
      entry.is_tow_pilot_available === true
    );
  }, [selectedDate, scheduleEntries, categories, formattedSelectedDate]);

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
            {obsLoading && !observationInput && !savedObservationText ? <Skeleton className="h-20 w-full" /> : ( 
              <Textarea
                ref={observationTextareaRef}
                placeholder="Escribe observaciones generales para la agenda de este día..."
                value={observationInput}
                onChange={(e) => setObservationInput(e.target.value)}
                rows={1} // Start with a small number of rows
                className="mb-3 resize-none overflow-hidden" // resize-none to prevent manual resize, overflow-hidden helps
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

      {selectedDate && !isTowPilotConfirmed && scheduleEntries.length > 0 && ( 
        <Alert variant="destructive" className="mb-6 shadow-sm">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Aún no hay piloto remolcador confirmado para esta fecha.
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
