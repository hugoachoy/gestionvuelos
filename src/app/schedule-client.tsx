
"use client";

import React from 'react'; // Explicit React import
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AvailabilityForm } from '@/components/schedule/availability-form';
import { ScheduleDisplay } from '@/components/schedule/schedule-display';
import { DeleteDialog } from '@/components/common/delete-dialog';
import {
  usePilotsStore,
  usePilotCategoriesStore,
  useAircraftStore,
  useScheduleStore,
  useDailyObservationsStore,
  useDailyNewsStore,
} from '@/store/data-hooks';
import type { ScheduleEntry, PilotCategory, DailyNews, Aircraft } from '@/types';
import { FLIGHT_TYPES } from '@/types';
import { PlusCircle, CalendarIcon, Save, RefreshCw, AlertTriangle, MessageSquarePlus, Send, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UnderlineKeywords } from '@/components/common/underline-keywords';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ShareButton } from '@/components/schedule/share-button';


const normalizeCategoryName = (name?: string): string => {
  return name?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
};

// Keywords for flexible matching in sorting/logic
const INSTRUCTOR_AVION_KEYWORDS = ["instructor", "avion"];
const INSTRUCTOR_PLANEADOR_KEYWORDS = ["instructor", "planeador"];

// Exact normalized names for warning checks
const NORMALIZED_INSTRUCTOR_AVION_CATEGORY_NAME = "instructor avion";
const NORMALIZED_INSTRUCTOR_PLANEADOR_CATEGORY_NAME = "instructor planeador";
const NORMALIZED_REMOLCADOR_CATEGORY_NAME = "remolcador";


function getSortPriority(
  entry: ScheduleEntry,
  categories: PilotCategory[],
  aircraftList: Aircraft[]
): number {
  const entryCategoryDetails = categories.find(c => c.id === entry.pilot_category_id);
  const normalizedEntryCategoryName = normalizeCategoryName(entryCategoryDetails?.name);
  const flightTypeId = entry.flight_type_id;
  const aircraftDetails = aircraftList.find(a => a.id === entry.aircraft_id);
  const aircraftType = aircraftDetails?.type;

  // Prioridad 1: Remolcadores
  if (normalizedEntryCategoryName === NORMALIZED_REMOLCADOR_CATEGORY_NAME) {
    return entry.is_tow_pilot_available ? 1.1 : 1.2; // Disponibles primero
  }

  // Prioridad 2: Instructores
  const isInstructor = normalizedEntryCategoryName === NORMALIZED_INSTRUCTOR_AVION_CATEGORY_NAME ||
                       normalizedEntryCategoryName === NORMALIZED_INSTRUCTOR_PLANEADOR_CATEGORY_NAME;
  if (isInstructor) {
    return 2;
  }
  
  // Prioridades para Pilotos
  if (flightTypeId === 'instruction_taken') {
    if (aircraftType === 'Glider') return 3; // 3. Pilotos de planeador en instrucción
    if (aircraftType === 'Tow Plane' || aircraftType === 'Avión') return 4; // 4. Pilotos de avión en instrucción
    return 4; // Default para instrucción
  }

  if (aircraftType === 'Glider') {
    if (flightTypeId === 'sport') return 5; // 5. Pilotos de planeador en vuelo deportivo
    if (flightTypeId === 'local') return 6; // 6. Pilotos de planeador en vuelo local
  }

  if (aircraftType === 'Tow Plane' || aircraftType === 'Avión') {
    if (flightTypeId === 'sport') return 7; // 7. Pilotos de avión en travesía (usando 'sport')
    if (flightTypeId === 'local') return 8; // 8. Pilotos de avión en vuelo local
  }

  return 99; // Default para otros casos
}


export function ScheduleClient() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const auth = useAuth();
  const router = useRouter();

  const { pilots, loading: pilotsLoading, error: pilotsError, fetchPilots } = usePilotsStore();
  const { categories, loading: categoriesLoading, error: categoriesError, fetchCategories } = usePilotCategoriesStore();
  const { aircraft, loading: aircraftLoading, error: aircraftError, fetchAircraft: fetchAircrafts } = useAircraftStore();
  const { scheduleEntries, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry: removeEntry, loading: scheduleLoading, error: scheduleError, fetchScheduleEntries } = useScheduleStore();
  const { getObservation, updateObservation, loading: obsLoading, error: obsError, fetchObservations } = useDailyObservationsStore();
  const { getNewsForDate, addDailyNewsItem, updateDailyNewsItem, deleteDailyNewsItem, loading: newsLoading, error: newsError, fetchDailyNews } = useDailyNewsStore();


  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
  const [newsToDelete, setNewsToDelete] = useState<DailyNews | null>(null);
  const [isNewsDeleteDialogOpen, setIsNewsDeleteDialogOpen] = useState(false);


  const [observationInput, setObservationInput] = useState('');
  const observationTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [newsInput, setNewsInput] = useState('');
  const newsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editingNewsItem, setEditingNewsItem] = useState<DailyNews | null>(null);


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
      fetchDailyNews(dateStr);
    }
  }, [selectedDate, fetchScheduleEntries, fetchObservations, fetchDailyNews]);

  const savedObservationText = useMemo(() => {
    return formattedSelectedDate ? getObservation(formattedSelectedDate) : undefined;
  }, [formattedSelectedDate, getObservation]);

  const newsItemsForSelectedDate = useMemo(() => {
    return formattedSelectedDate ? getNewsForDate(formattedSelectedDate) : [];
  }, [formattedSelectedDate, getNewsForDate]);

  useEffect(() => {
    // This useEffect fetches data that doesn't depend on the selected date.
    // It runs once when the component mounts.
    fetchPilots();
    fetchCategories();
    fetchAircrafts();
  }, [fetchPilots, fetchCategories, fetchAircrafts]);


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
    if (newsTextareaRef.current) {
      newsTextareaRef.current.style.height = 'auto';
      newsTextareaRef.current.style.height = `${newsTextareaRef.current.scrollHeight}px`;
    }
  }, [newsInput]);


  const handleSaveObservation = async () => {
    if (selectedDate && auth.user?.is_admin) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await updateObservation(dateStr, observationInput);
      toast({ title: "Observaciones guardadas", description: "Las observaciones para el día han sido guardadas." });
    } else {
      toast({ title: "Acción no permitida", description: "Solo los administradores pueden guardar observaciones.", variant: "destructive" });
    }
  };

  const handleSaveNews = async () => {
    if (!selectedDate || !auth.user || newsInput.trim() === '') {
      if (newsInput.trim() === '') {
        toast({ title: "Novedad vacía", description: "Por favor, escribe tu novedad.", variant: "default" });
      }
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (editingNewsItem) {
      // Estamos editando una novedad existente
      const result = await updateDailyNewsItem(editingNewsItem.id, newsInput.trim(), dateStr);
      if (result) {
        toast({ title: "Novedad actualizada", description: "La novedad ha sido actualizada." });
      } else {
        toast({ title: "Error", description: "No se pudo actualizar la novedad.", variant: "destructive" });
      }
      setEditingNewsItem(null);
    } else {
      // Estamos agregando una nueva novedad
      let pilotDisplayName = '';
      const pilotProfileFromStore = pilots.find(p => p.auth_user_id === auth.user!.id);

      if (pilotProfileFromStore) {
        if (pilotProfileFromStore.last_name && pilotProfileFromStore.first_name) {
          pilotDisplayName = `${pilotProfileFromStore.last_name}, ${pilotProfileFromStore.first_name}`;
        } else if (pilotProfileFromStore.last_name) {
          pilotDisplayName = pilotProfileFromStore.last_name;
        } else if (pilotProfileFromStore.first_name) {
          pilotDisplayName = pilotProfileFromStore.first_name;
        } else {
          pilotDisplayName = auth.user.email || 'Piloto Anónimo';
        }
      } else {
        if (auth.user.last_name && auth.user.first_name) {
          pilotDisplayName = `${auth.user.last_name}, ${auth.user.first_name}`;
        } else if (auth.user.last_name) {
          pilotDisplayName = auth.user.last_name;
        } else if (auth.user.first_name) {
          pilotDisplayName = auth.user.first_name;
        } else {
          pilotDisplayName = auth.user.email || 'Piloto Anónimo';
        }
      }

      const newsData: Omit<DailyNews, 'id' | 'created_at' | 'updated_at'> = {
        date: dateStr,
        news_text: newsInput.trim(),
        pilot_id: auth.user.id,
        pilot_full_name: pilotDisplayName,
      };
      const result = await addDailyNewsItem(newsData);
      if (result) {
        toast({ title: "Novedad agregada", description: "Tu novedad ha sido guardada." });
      } else {
        toast({ title: "Error", description: "No se pudo guardar la novedad.", variant: "destructive" });
      }
    }
    setNewsInput(''); // Limpiar input en ambos casos (agregar/editar)
  };

  const handleEditNewsItem = (newsItem: DailyNews) => {
    setEditingNewsItem(newsItem);
    setNewsInput(newsItem.news_text);
    newsTextareaRef.current?.focus();
  };

  const handleCancelEditNews = () => {
    setEditingNewsItem(null);
    setNewsInput('');
  };

  const handleDeleteNewsConfirmation = (newsItem: DailyNews) => {
    setNewsToDelete(newsItem);
    setIsNewsDeleteDialogOpen(true);
  };

  const confirmDeleteNews = async () => {
    if (newsToDelete && selectedDate) {
      const success = await deleteDailyNewsItem(newsToDelete.id, format(selectedDate, 'yyyy-MM-dd'));
      if (success) {
        toast({ title: "Novedad eliminada", description: "La novedad ha sido eliminada." });
      } else {
        toast({ title: "Error", description: "No se pudo eliminar la novedad.", variant: "destructive" });
      }
    }
    setIsNewsDeleteDialogOpen(false);
    setNewsToDelete(null);
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
    if (entryToDelete && selectedDate) {
      await removeEntry(entryToDelete.id, format(selectedDate, 'yyyy-MM-dd'));
    }
    setIsDeleteDialogOpen(false);
    setEntryToDelete(null);
  };

  const handleSubmitForm = useCallback(async (data: Omit<ScheduleEntry, 'id' | 'created_at'>[], entryId?: string) => {
    if (entryId) { // Editing existing entry
      if(data.length === 1) { // Should always be one for editing
        await updateScheduleEntry({ ...data[0], id: entryId });
      } else {
         toast({ title: "Error de Edición", description: "No se pueden crear múltiples turnos al editar.", variant: "destructive" });
      }
    } else { // Adding new entries
      for (const entryData of data) {
        await addScheduleEntry(entryData);
      }
    }
    setIsFormOpen(false);
  }, [addScheduleEntry, updateScheduleEntry, toast]);

  const filteredAndSortedEntries = useMemo(() => {
    if (!selectedDate || !scheduleEntries || categoriesLoading || aircraftLoading || !pilots?.length || !categories?.length || !aircraft?.length) {
      return [];
    }

    return [...scheduleEntries].sort((a, b) => {
      const priorityA = getSortPriority(a, categories, aircraft);
      const priorityB = getSortPriority(b, categories, aircraft);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Secondary sort by time if priorities are equal
      return a.start_time.localeCompare(b.start_time);
    });
  }, [selectedDate, scheduleEntries, categories, categoriesLoading, aircraft, aircraftLoading, pilots]);


  const handleRefreshAll = useCallback(() => {
    fetchPilots();
    fetchCategories();
    fetchAircrafts();
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetchScheduleEntries(dateStr);
      fetchObservations(dateStr);
      fetchDailyNews(dateStr);
    } else {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        fetchScheduleEntries(todayStr);
        fetchObservations(todayStr);
        fetchDailyNews(todayStr);
    }
  }, [selectedDate, fetchPilots, fetchCategories, fetchAircrafts, fetchScheduleEntries, fetchObservations, fetchDailyNews]);

  const anyLoading = pilotsLoading || categoriesLoading || aircraftLoading || scheduleLoading || obsLoading || newsLoading;
  const anyError = pilotsError || categoriesError || aircraftError || scheduleError || obsError || newsError;

  // Check if "Instructor Avión" category exists
  const avionInstructorCategoryExists = useMemo(() => {
    if (categoriesLoading || !categories || !categories.length) return false;
    return categories.some(cat => normalizeCategoryName(cat.name) === NORMALIZED_INSTRUCTOR_AVION_CATEGORY_NAME);
  }, [categories, categoriesLoading]);

  // Check if an "Instructor Avión" is confirmed for the selected date
  const isAvionInstructorConfirmed = useMemo(() => {
    if (anyLoading || !categories || !categories.length || !selectedDate) {
        return true;
    }
    const avionInstructorCategory = categories.find(cat => normalizeCategoryName(cat.name) === NORMALIZED_INSTRUCTOR_AVION_CATEGORY_NAME);
    if (!avionInstructorCategory) {
      return true;
    }
    return scheduleEntries.some(entry => entry.pilot_category_id === avionInstructorCategory.id);
  }, [scheduleEntries, categories, anyLoading, selectedDate]);

  // Check if "Instructor Planeador" category exists
  const planeadorInstructorCategoryExists = useMemo(() => {
    if (categoriesLoading || !categories || !categories.length) return false;
    return categories.some(cat => normalizeCategoryName(cat.name) === NORMALIZED_INSTRUCTOR_PLANEADOR_CATEGORY_NAME);
  }, [categories, categoriesLoading]);

  // Check if an "Instructor Planeador" is confirmed for the selected date
  const isPlaneadorInstructorConfirmed = useMemo(() => {
    if (anyLoading || !categories || !categories.length || !selectedDate) {
        return true;
    }
    const planeadorInstructorCategory = categories.find(cat => normalizeCategoryName(cat.name) === NORMALIZED_INSTRUCTOR_PLANEADOR_CATEGORY_NAME);
    if (!planeadorInstructorCategory) {
      return true;
    }
    return scheduleEntries.some(entry => entry.pilot_category_id === planeadorInstructorCategory.id);
  }, [scheduleEntries, categories, anyLoading, selectedDate]);

  // Check if "Remolcador" category exists and is confirmed
  const remolcadorCategoryExists = useMemo(() => {
    if (categoriesLoading || !categories || !categories.length) return false;
    return categories.some(cat => normalizeCategoryName(cat.name) === NORMALIZED_REMOLCADOR_CATEGORY_NAME);
  }, [categories, categoriesLoading]);

  const isRemolcadorConfirmed = useMemo(() => {
    if (anyLoading || !categories || !categories.length || !selectedDate) {
        return true;
    }
    const towPilotCategory = categories.find(cat => normalizeCategoryName(cat.name) === NORMALIZED_REMOLCADOR_CATEGORY_NAME);
    if (!towPilotCategory) {
      return true;
    }
    return scheduleEntries.some(entry =>
      entry.pilot_category_id === towPilotCategory.id &&
      entry.is_tow_pilot_available === true
    );
  }, [scheduleEntries, categories, anyLoading, selectedDate]);


 const handleRegisterFlight = (entry: ScheduleEntry) => {
    const aircraftUsed = aircraft.find(ac => ac.id === entry.aircraft_id);
    let flightTypeForLogbook: 'glider' | 'engine' | undefined;
    let targetPath = '';
    const queryParams = new URLSearchParams({
        schedule_id: entry.id,
        date: entry.date,
        pilot_id: entry.pilot_id,
        start_time: entry.start_time.substring(0,5),
    });
    if (entry.aircraft_id) {
        queryParams.set('aircraft_id', entry.aircraft_id);
    }


    if (aircraftUsed) {
        if (aircraftUsed.type === 'Glider') {
            flightTypeForLogbook = 'glider';
            targetPath = '/logbook/glider/new';
        } else if (aircraftUsed.type === 'Tow Plane' || aircraftUsed.type === 'Avión') {
            flightTypeForLogbook = 'engine';
            targetPath = '/logbook/engine/new';
        }
    } else {
        const pilotCategoryForTurn = categories.find(cat => cat.id === entry.pilot_category_id);
        const normalizedCategoryName = normalizeCategoryName(pilotCategoryForTurn?.name);
        
        const isCurrentTurnAvionInstructor = INSTRUCTOR_AVION_KEYWORDS.every(kw => normalizedCategoryName.includes(kw));
        const isCurrentTurnPlaneadorInstructor = INSTRUCTOR_PLANEADOR_KEYWORDS.every(kw => normalizedCategoryName.includes(kw));


        if (normalizedCategoryName.includes('planeador') || entry.flight_type_id === 'sport' || entry.flight_type_id === 'instruction_taken' || (entry.flight_type_id === 'instruction_given' && isCurrentTurnPlaneadorInstructor) ) {
            flightTypeForLogbook = 'glider';
            targetPath = '/logbook/glider/new';
        } else if (entry.flight_type_id === 'towage' || normalizedCategoryName.includes('remolcador') || normalizedCategoryName.includes('avion') || (entry.flight_type_id === 'instruction_given' && isCurrentTurnAvionInstructor)) {
            flightTypeForLogbook = 'engine';
            targetPath = '/logbook/engine/new';
        }
    }

    if (flightTypeForLogbook && targetPath) {
        router.push(`${targetPath}?${queryParams.toString()}`);
    } else {
        toast({
            title: "Tipo de Vuelo Ambiguo",
            description: "No se pudo determinar el tipo de vuelo para registrar. Revise los datos del turno o registre manualmente.",
            variant: "destructive",
        });
    }
  };


  if (anyError) {
    return (
      <div className="text-destructive p-4">
        Error al cargar datos: {anyError.message || JSON.stringify(anyError)}
        <Button onClick={handleRefreshAll} className="ml-2 mt-2">Reintentar Cargar Todo</Button>
      </div>
    );
  }

  const uiDisabled = auth.loading || anyLoading;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <p className="font-medium shrink-0">Seleccionar fecha:</p>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"default"}
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal",
                    !selectedDate && "text-primary-foreground/70"
                  )}
                  disabled={uiDisabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                  locale={es}
                  disabled={uiDisabled}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={handleRefreshAll} variant="outline" size="icon" disabled={uiDisabled} className="h-10 w-10">
              <RefreshCw className={cn("h-4 w-4", uiDisabled && "animate-spin")} />
            </Button>
            {selectedDate && <ShareButton scheduleDate={selectedDate} />}
            <Button onClick={handleAddEntry} disabled={uiDisabled || !auth.user} className="flex-grow">
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Turno
            </Button>
          </div>
      </div>


      {selectedDate && (
        <Card className="mb-6 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Observaciones del Día (sólo Administrador)</CardTitle>
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
                disabled={uiDisabled || !auth.user?.is_admin}
              />
            )}
            <Button onClick={handleSaveObservation} size="sm" disabled={uiDisabled || !auth.user?.is_admin}>
              <Save className="mr-2 h-4 w-4" />
              Guardar Observaciones
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedDate &&
       !isAvionInstructorConfirmed &&
       !anyLoading &&
       !auth.loading &&
       avionInstructorCategoryExists &&
        <Alert variant="default" className="mb-6 shadow-sm border-orange-400 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <strong className="text-orange-700">
                Aún no hay "<UnderlineKeywords text="Instructor Avión" />" confirmado para esta fecha.
            </strong>
          </AlertDescription>
        </Alert>
      }

      {selectedDate &&
       !isPlaneadorInstructorConfirmed &&
       !anyLoading &&
       !auth.loading &&
       planeadorInstructorCategoryExists &&
        <Alert variant="default" className="mb-6 shadow-sm border-orange-400 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <strong className="text-orange-700">
                Aún no hay "<UnderlineKeywords text="Instructor Planeador" />" confirmado para esta fecha.
            </strong>
          </AlertDescription>
        </Alert>
      }

      {selectedDate &&
       !isRemolcadorConfirmed &&
       !anyLoading &&
       !auth.loading &&
       remolcadorCategoryExists &&
        <Alert variant="default" className="mb-6 shadow-sm border-orange-400 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <strong className="text-orange-700">
                Aún no hay "<UnderlineKeywords text="REMOLCADOR" />" confirmado para esta fecha.
            </strong>
          </AlertDescription>
        </Alert>
      }

      {(scheduleLoading || auth.loading) && !filteredAndSortedEntries.length ? (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : selectedDate && (
        <ScheduleDisplay
          entries={filteredAndSortedEntries}
          onEdit={handleEditEntry}
          onDelete={handleDeleteEntry}
          onRegisterFlight={handleRegisterFlight}
        />
      )}

      {selectedDate && (
        <Card className="mt-6 mb-6 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Novedades del Día</CardTitle>
          </CardHeader>
          <CardContent>
            {newsLoading && !newsItemsForSelectedDate.length ? (
              <Skeleton className="h-10 w-full mb-3" />
            ) : newsItemsForSelectedDate.length > 0 ? (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-2">
                {newsItemsForSelectedDate.map(news => (
                  <div key={news.id} className="text-sm p-2 border-b group">
                    <div className="flex justify-between items-start">
                        <p className="whitespace-pre-wrap flex-grow">{news.news_text}</p>
                        {auth.user?.is_admin && (
                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => handleEditNewsItem(news)} className="h-7 w-7 hover:text-primary">
                                    <Edit className="h-3 w-3" />
                                    <span className="sr-only">Editar Novedad</span>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteNewsConfirmation(news)} className="h-7 w-7 hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                    <span className="sr-only">Eliminar Novedad</span>
                                </Button>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      - {news.pilot_full_name}
                      ({news.created_at && parseISO(news.created_at) ? format(parseISO(news.created_at), 'HH:mm', { locale: es }) : 'Hora desconocida'})
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">No hay novedades para este día.</p>
            )}
            <Textarea
              ref={newsTextareaRef}
              placeholder={editingNewsItem ? "Editando novedad..." : "Escribe una novedad para el día..."}
              value={newsInput}
              onChange={(e) => setNewsInput(e.target.value)}
              rows={1}
              className="mb-3 resize-none overflow-hidden"
              disabled={uiDisabled || !auth.user}
            />
            <div className="flex gap-2">
                <Button onClick={handleSaveNews} size="sm" disabled={uiDisabled || !auth.user || newsInput.trim() === ''}>
                <Send className="mr-2 h-4 w-4" />
                {editingNewsItem ? "Guardar Cambios" : "Agregar Novedad"}
                </Button>
                {editingNewsItem && (
                    <Button onClick={handleCancelEditNews} size="sm" variant="outline">
                        Cancelar Edición
                    </Button>
                )}
            </div>
          </CardContent>
        </Card>
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
      <DeleteDialog
        open={isNewsDeleteDialogOpen}
        onOpenChange={setIsNewsDeleteDialogOpen}
        onConfirm={confirmDeleteNews}
        itemName={newsToDelete ? `la novedad de "${newsToDelete.pilot_full_name}"` : 'esta novedad'}
      />
    </>
  );
}
