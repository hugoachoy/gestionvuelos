
"use client";

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/common/page-header';
import { AvailabilityForm, type AvailabilityFormData } from '@/components/schedule/availability-form';
import { ScheduleDisplay } from '@/components/schedule/schedule-display';
import { ShareButton } from '@/components/schedule/share-button';
import { DeleteDialog } from '@/components/common/delete-dialog';
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore, useScheduleStore } from '@/store/data-hooks';
import type { ScheduleEntry, PilotCategory } from '@/types';
import { PlusCircle, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScheduleClient() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const { pilots } = usePilotsStore();
  const { categories, getCategoryName } = usePilotCategoriesStore();
  const { aircraft } = useAircraftStore();
  const { scheduleEntries, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry: removeEntry } = useScheduleStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);

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

  const confirmDelete = () => {
    if (entryToDelete) {
      removeEntry(entryToDelete.id);
    }
    setIsDeleteDialogOpen(false);
    setEntryToDelete(null);
  };

  const handleSubmitForm = (data: AvailabilityFormData, entryId?: string) => {
    const entryData = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'), // Store date as string
    };
    if (entryId) {
      updateScheduleEntry({ ...entryData, id: entryId });
    } else {
      addScheduleEntry(entryData);
    }
    setIsFormOpen(false);
  };

  const filteredAndSortedEntries = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    const categoryOrderValues: Record<string, number> = {
      'Piloto remolcador': 1,
      'Instructor': 2,
    };

    return scheduleEntries
      .filter(entry => entry.date === dateStr)
      .sort((a, b) => {
        const catA_Name = getCategoryName(a.pilotCategoryId);
        const catB_Name = getCategoryName(b.pilotCategoryId);

        const orderA = categoryOrderValues[catA_Name] || 3; // Other categories are 3
        const orderB = categoryOrderValues[catB_Name] || 3;

        // 1. Sort by specific category order
        if (orderA !== orderB) {
          return orderA - orderB;
        }

        // 2. If category is 'Piloto remolcador', sort by availability
        if (catA_Name === 'Piloto remolcador') {
          if (a.isTowPilotAvailable && !b.isTowPilotAvailable) return -1;
          if (!a.isTowPilotAvailable && b.isTowPilotAvailable) return 1;
        }
        
        // 3. Prioritize 'Deportivo' flight type
        const isSportA = a.flightTypeId === 'sport';
        const isSportB = b.flightTypeId === 'sport';

        if (isSportA && !isSportB) return -1;
        if (!isSportA && isSportB) return 1;

        // 4. Finally, sort by start time
        return a.startTime.localeCompare(b.startTime);
      });
  }, [selectedDate, scheduleEntries, categories, getCategoryName]);
  
  // Ensure selectedDate is initialized on client side
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
  }, [selectedDate]);


  return (
    <>
      <PageHeader 
        title="Agenda de Vuelos"
        action={
          <div className="flex gap-2">
            {selectedDate && filteredAndSortedEntries.length > 0 && (
              <ShareButton scheduleDate={selectedDate} entries={filteredAndSortedEntries} />
            )}
            <Button onClick={handleAddEntry} disabled={!selectedDate}>
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
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>
      
      {selectedDate && (
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
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={entryToDelete ? `el turno de las ${entryToDelete.startTime}` : 'este turno'}
      />
    </>
  );
}
