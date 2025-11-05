

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Pilot, PilotCategory, Aircraft as BaseAircraft, ScheduleEntry, DailyObservation, DailyNews, CompletedGliderFlight, CompletedEngineFlight, CompletedFlight, Rate, FlightPurpose } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { format, isValid as isValidDate, parseISO, startOfDay, isAfter, isBefore, differenceInHours, subYears } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type Aircraft = BaseAircraft & { hours_since_oil_change?: number | null, total_oil_added_since_review?: number | null };

// Helper function for more detailed error logging
function logSupabaseError(context: string, error: any) {
  console.error(`${context}. Raw error object (stringified):`, JSON.stringify(error));
  console.error(`${context}. Raw error object (actual):`, error);

  if (error && typeof error === 'object') {
    const props = Object.keys(error);
    if (props.length === 0) {
      console.error('Supabase error object appears empty.');
    } else {
      console.error('Supabase error object properties:', props.join(', '));
    }

    if (error.code === 'PGRST116') {
      console.warn("Hint: Error PGRST116 (JSON object requested, multiple (or no) rows returned) occurred. Check RLS policies or if the record ID for an update/delete existed or was accessible post-operation.");
    }
    if ('message' in error) console.error('Supabase error message:', error.message);
    if ('details' in error) console.error('Supabase error details:', error.details);
    if ('hint' in error) console.error('Supabase error hint:', error.hint);
    if ('code' in error) console.error('Supabase error code:', error.code);
    // Attempt to catch Fetch API-like errors if they are not standard Supabase errors
    if ('status' in error && 'statusText' in error && !('message' in error)) {
        console.error(`HTTP-like error: Status ${error.status} - ${error.statusText}`);
    }
  } else if (error) {
    console.error('Supabase error is not a typical object. Value:', error);
  } else {
    console.error('Supabase error is null or undefined.');
  }
}

// Pilots Store
export function usePilotsStore() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchPilots = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('pilots').select('*').order('last_name').order('first_name');
      if (fetchError) {
        logSupabaseError('Error fetching pilots', fetchError);
        setError(fetchError);
      } else {
        setPilots(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchPilots', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchPilots();
  }, [fetchPilots]);

  const addPilot = useCallback(async (pilotData: Omit<Pilot, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true);

    const payload = { ...pilotData };
    if (!payload.hasOwnProperty('is_admin')) {
      payload.is_admin = false;
    }

    const { data: newPilot, error: insertError } = await supabase
      .from('pilots')
      .insert([payload])
      .select()
      .single();

    if (insertError) {
      logSupabaseError('Error adding pilot', insertError);
      setError(insertError);
      setLoading(false);
      return null;
    }
    if (newPilot) {
      await fetchPilots();
    }
    setLoading(false);
    return newPilot;
  }, [fetchPilots]);

  const updatePilot = useCallback(async (updatedPilotData: Pilot) => {
    setLoading(true);
    setError(null);
    try {
      const { id, created_at, ...updatePayload } = updatedPilotData;

      const { error: supabaseUpdateError } = await supabase
        .from('pilots')
        .update(updatePayload)
        .eq('id', id);
  
      if (supabaseUpdateError) {
        logSupabaseError('Error updating pilot (during Supabase update operation)', supabaseUpdateError);
        throw supabaseUpdateError;
      }
  
      // Optimistic update
      setPilots(prevPilots => 
        prevPilots.map(p => p.id === id ? { ...p, ...updatedPilotData } : p)
      );

      return updatedPilotData;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);


  const deletePilot = useCallback(async (pilotId: string) => {
    setError(null);
    setLoading(true);
    let success = false;
    try {
      const { error: deleteError, count } = await supabase
        .from('pilots')
        .delete({ count: 'exact' })
        .eq('id', pilotId);

      if (deleteError) {
        logSupabaseError('Error deleting pilot from Supabase', deleteError);
        setError(deleteError);
      } else if (count === 0) {
        console.warn(`Pilot delete for ID ${pilotId} affected 0 rows. RLS policy might be preventing the delete or pilot ID not found.`);
        setError(new Error("La eliminación no afectó a ninguna fila. Verifique los permisos (RLS) o si el piloto existe."));
      } else {
        setPilots(prevPilots => prevPilots.filter(p => p.id !== pilotId));
        success = true;
        // Optionally, refetch in the background if needed, but optimistic update is primary
        fetchPilots().catch(syncError => {
          console.error("Background sync after pilot delete failed:", syncError);
          // Potentially revert optimistic update or notify user if background sync fails critically
        });
      }
    } catch (e: any) {
      logSupabaseError('Unexpected error during pilot deletion process', e);
      setError(e);
    } finally {
        setLoading(false);
    }
    return success;
  }, [fetchPilots]);


  const getPilotName = useCallback((pilotId?: string | null): string => {
    if (!pilotId) return '-';
    const pilot = pilots.find(p => p.id === pilotId);
    return pilot ? `${pilot.first_name} ${pilot.last_name}` : 'Piloto no encontrado';
  }, [pilots]);

  return { pilots, loading, error, addPilot, updatePilot, deletePilot, getPilotName, fetchPilots };
}

// Pilot Categories Store
export function usePilotCategoriesStore() {
  const [categories, setCategories] = useState<PilotCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchCategories = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('pilot_categories').select('*').order('name');
      if (fetchError) {
        logSupabaseError('Error fetching pilot categories', fetchError);
        setError(fetchError);
      } else {
         setCategories(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchCategories', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = useCallback(async (categoryData: Omit<PilotCategory, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true);
    try {
        const { data: newCategory, error: insertError } = await supabase
        .from('pilot_categories')
        .insert([categoryData])
        .select()
        .single();
        if (insertError) {
        logSupabaseError('Error adding pilot category', insertError);
        setError(insertError);
        return null;
        }
        if (newCategory) {
        await fetchCategories();
        }
        return newCategory;
    } catch (e) {
        logSupabaseError('Unexpected error adding category', e);
        setError(e);
        return null;
    } finally {
        setLoading(false);
    }
  }, [fetchCategories]);

  const updateCategory = useCallback(async (updatedCategoryData: PilotCategory) => {
    setError(null);
    setLoading(true);
    try {
        const { id, created_at, ...updatePayload } = updatedCategoryData;
        const { data: updatedCategory, error: updateError } = await supabase
        .from('pilot_categories')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
        if (updateError) {
        logSupabaseError('Error updating pilot category', updateError);
        setError(updateError);
        return null;
        }
        if (updatedCategory) {
        await fetchCategories();
        }
        return updatedCategory;
    } catch (e) {
        logSupabaseError('Unexpected error updating category', e);
        setError(e);
        return null;
    } finally {
        setLoading(false);
    }
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    setError(null);
    setLoading(true);
    try {
        const { error: deleteError } = await supabase.from('pilot_categories').delete().eq('id', categoryId);
        if (deleteError) {
        logSupabaseError('Error deleting pilot category', deleteError);
        setError(deleteError);
        return false;
        }
        await fetchCategories();
        return true;
    } catch (e) {
        logSupabaseError('Unexpected error deleting category', e);
        setError(e);
        return false;
    } finally {
        setLoading(false);
    }
  }, [fetchCategories]);

  const getCategoryName = useCallback((categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Categoría desconocida';
  }, [categories]);

  return { categories, loading, error, addCategory, updateCategory, deleteCategory, getCategoryName, fetchCategories };
}


// AIRCRAFT STORE
export function useAircraftStore() {
    const [aircraft, setAircraft] = useState<BaseAircraft[]>([]);
    const [aircraftWithCalculatedData, setAircraftWithCalculatedData] = useState<Aircraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const fetchingRef = useRef(false);
    const { toast } = useToast();

    const fetchAircraft = useCallback(async (force = false) => {
        if (fetchingRef.current && !force) return;

        fetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const { data: aircraftData, error: aircraftError } = await supabase
                .from('aircraft')
                .select('*')
                .order('name');
            
            if (aircraftError) throw aircraftError;
            
            const engineAircraftIds = (aircraftData || []).filter(ac => ac.type !== 'Glider').map(ac => ac.id);
            const oneYearAgo = format(subYears(new Date(), 1), 'yyyy-MM-dd');
            
            let flightsData: any[] = [];
            if (engineAircraftIds.length > 0) {
                 const { data: fetchedFlightsData, error: flightsError } = await supabase
                    .from('completed_engine_flights')
                    .select('engine_aircraft_id, date, flight_duration_decimal, oil_added_liters')
                    .in('engine_aircraft_id', engineAircraftIds)
                    .gte('date', oneYearAgo);

                if (flightsError) throw flightsError;
                flightsData = fetchedFlightsData || [];
            }
            
            setAircraft(aircraftData || []); // Set the base aircraft data

            const calculatedAircraft = (aircraftData || []).map(ac => {
                if (ac.type === 'Glider') {
                    return { ...ac, hours_since_oil_change: null, total_oil_added_since_review: null };
                }

                const effectiveStartDate = ac.last_oil_change_date ? parseISO(ac.last_oil_change_date) : null;
                
                if (!effectiveStartDate || !isValidDate(effectiveStartDate)) {
                     return { ...ac, hours_since_oil_change: 0, total_oil_added_since_review: 0 };
                }
                
                const relevantFlights = flightsData.filter(flight => 
                    flight.engine_aircraft_id === ac.id &&
                    isValidDate(parseISO(flight.date)) &&
                    !isBefore(startOfDay(parseISO(flight.date)), startOfDay(effectiveStartDate))
                );

                const hours = relevantFlights.reduce((sum, flight) => sum + flight.flight_duration_decimal, 0);
                const totalOilAdded = relevantFlights.reduce((sum, flight) => sum + (flight.oil_added_liters || 0), 0);

                return { ...ac, hours_since_oil_change: hours, total_oil_added_since_review: totalOilAdded };
            });

            setAircraftWithCalculatedData(calculatedAircraft);
        } catch (e: any) {
            logSupabaseError('Error fetching aircraft data', e);
            setError(e);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchAircraft();
    }, [fetchAircraft]);

    const addAircraft = useCallback(async (aircraftData: Omit<BaseAircraft, 'id' | 'created_at'>) => {
        setLoading(true);
        const { data, error } = await supabase.from('aircraft').insert([aircraftData]).select().single();
        if (error) {
            logSupabaseError('Error adding aircraft', error);
            setError(error);
            setLoading(false);
            return null;
        }
        await fetchAircraft(true); // Force refetch after adding
        return data;
    }, [fetchAircraft]);

    const updateAircraft = useCallback(async (updatedData: BaseAircraft) => {
        setLoading(true);
        const { id, ...updatePayload } = updatedData;
        const { data, error } = await supabase.from('aircraft').update(updatePayload).eq('id', id).select().single();
        if (error) {
            logSupabaseError('Error updating aircraft', error);
            setError(error);
            setLoading(false);
            return null;
        }
        await fetchAircraft(true); // Force refetch after updating
        return data;
    }, [fetchAircraft]);

    const deleteAircraft = useCallback(async (id: string) => {
        setLoading(true);
        const { error } = await supabase.from('aircraft').delete().eq('id', id);
        if (error) {
            // Check for foreign key violation
            if (error.code === '23503') {
                toast({
                    title: "Acción no permitida",
                    description: "No se puede eliminar la aeronave porque tiene vuelos registrados. Considere ponerla 'Fuera de Servicio' en su lugar.",
                    variant: "destructive",
                    duration: 7000
                });
                setError(null); // Clear the error as it's been handled gracefully
            } else {
                logSupabaseError('Error deleting aircraft', error);
                setError(error);
                 toast({
                    title: "Error al Eliminar",
                    description: "Ocurrió un error inesperado al intentar eliminar la aeronave.",
                    variant: "destructive",
                });
            }
            setLoading(false);
            return false;
        }
        await fetchAircraft(true); // Force refetch after deleting
        return true;
    }, [fetchAircraft, toast]);

    const getAircraftName = useCallback((aircraftId?: string | null): string => {
        if (!aircraftId) return 'N/A';
        const ac = aircraftWithCalculatedData.find(a => a.id === aircraftId);
        return ac ? ac.name : 'Aeronave no encontrada';
    }, [aircraftWithCalculatedData]);

    return { aircraft, aircraftWithCalculatedData, loading, error, fetchAircraft, addAircraft, updateAircraft, deleteAircraft, getAircraftName };
}

// Rates Store
export function useRatesStore() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchRates = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('rates').select('*').order('item_name');
      if (fetchError) {
        logSupabaseError('Error fetching rates', fetchError);
        setError(fetchError);
      } else {
        setRates(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchRates', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const addRate = useCallback(async (rateData: Omit<Rate, 'id' | 'created_at'>) => {
    setLoading(true);
    const { data, error } = await supabase.from('rates').insert([rateData]).select().single();
    if (error) {
        logSupabaseError('Error adding rate', error);
        setError(error);
        setLoading(false);
        return null;
    }
    await fetchRates();
    return data;
  }, [fetchRates]);

  const updateRate = useCallback(async (updatedData: Rate) => {
    setLoading(true);
    const { id, ...updatePayload } = updatedData;
    const { data, error } = await supabase.from('rates').update(updatePayload).eq('id', id).select().single();
    if (error) {
        logSupabaseError('Error updating rate', error);
        setError(error);
        setLoading(false);
        return null;
    }
    await fetchRates();
    return data;
  }, [fetchRates]);

  const deleteRate = useCallback(async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('rates').delete().eq('id', id);
    if (error) {
        logSupabaseError('Error deleting rate', error);
        setError(error);
        setLoading(false);
        return false;
    }
    await fetchRates();
    return true;
  }, [fetchRates]);

  return { rates, loading, error, fetchRates, addRate, updateRate, deleteRate };
}


// Schedule Store
export function useScheduleStore() {
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false); // Initial state false
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchScheduleEntries = useCallback(async (date?: string) => {
    if (fetchingRef.current && !date) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('schedule_entries').select('*');
      if (date) {
        query = query.eq('date', date);
      }
      query = query.order('date').order('start_time');
      const { data, error: fetchError } = await query;
      if (fetchError) {
        logSupabaseError('Error fetching schedule entries', fetchError);
        setError(fetchError);
      } else {
        setScheduleEntries(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchScheduleEntries', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const fetchScheduleEntriesForRange = useCallback(async (startDateStr: string, endDateStr: string): Promise<ScheduleEntry[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('schedule_entries')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date')
        .order('start_time');
      if (fetchError) {
        logSupabaseError('Error fetching schedule entries for range', fetchError);
        setError(fetchError);
        return null;
      }
      return data || [];
    } catch (e) {
      logSupabaseError('Unexpected error in fetchScheduleEntriesForRange', e);
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addScheduleEntry = useCallback(async (entryDataList: Omit<ScheduleEntry, 'id' | 'created_at'>[]) => {
    setError(null);
    setLoading(true);

    try {
        // Ensure auth_user_id is not null/undefined
        const cleanedEntryDataList = entryDataList.map(e => ({...e, auth_user_id: e.auth_user_id ?? ''}));

        const { data: newEntries, error: insertError } = await supabase
            .from('schedule_entries')
            .insert(cleanedEntryDataList)
            .select();

        if (insertError) {
            logSupabaseError('Error adding schedule entry', insertError);
            setError(insertError);
            return null;
        }

        if (newEntries && newEntries.length > 0) {
            // After adding, refetch for the date of the first new entry to update the UI
            await fetchScheduleEntries(newEntries[0].date);
        }
        return newEntries;
    } catch (e) {
        logSupabaseError('Unexpected error adding schedule entry', e);
        setError(e);
        return null;
    } finally {
        setLoading(false);
    }
}, [fetchScheduleEntries]);


  const updateScheduleEntry = useCallback(async (updatedEntryData: ScheduleEntry) => {
    setError(null);
    setLoading(true);
    try {
        const { created_at, id, ...updatePayload } = updatedEntryData;
        const { data: updatedEntry, error: updateError } = await supabase
        .from('schedule_entries')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
        if (updateError) {
        logSupabaseError('Error updating schedule entry', updateError);
        setError(updateError);
        return null;
        }
        if (updatedEntry) {
        await fetchScheduleEntries(updatedEntry.date);
        }
        return updatedEntry;
    } catch (e) {
        logSupabaseError('Unexpected error updating schedule entry', e);
        setError(e);
        return null;
    } finally {
        setLoading(false);
    }
  }, [fetchScheduleEntries]);

  const deleteScheduleEntry = useCallback(async (entryId: string, entryDate: string) => {
    setError(null);
    setLoading(true);
    try {
        const { error: deleteError } = await supabase.from('schedule_entries').delete().eq('id', entryId);
        if (deleteError) {
        logSupabaseError('Error deleting schedule entry', deleteError);
        setError(deleteError);
        return false;
        }
        await fetchScheduleEntries(entryDate);
        return true;
    } catch (e) {
        logSupabaseError('Unexpected error deleting schedule entry', e);
        setError(e);
        return false;
    } finally {
        setLoading(false);
    }
  }, [fetchScheduleEntries]);

  return { scheduleEntries, loading, error, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, fetchScheduleEntries, fetchScheduleEntriesForRange };
}

// Daily Observations Store
export type DailyObservationsMap = Record<string, DailyObservation>;

export function useDailyObservationsStore() {
  const [dailyObservations, setDailyObservations] = useState<DailyObservationsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchObservations = useCallback(async (date?: string) => {
    if (fetchingRef.current && !date) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('daily_observations').select('*');
      if (date) {
        query = query.eq('date', date);
      }
      const { data, error: fetchError } = await query;
      if (fetchError) {
        logSupabaseError('Error fetching daily observations', fetchError);
        setError(fetchError);
      } else {
        const newObservationsMap: DailyObservationsMap = {};
        (data || []).forEach(obs => {
          newObservationsMap[obs.date] = obs;
        });
        setDailyObservations(prev => date ? {...prev, ...newObservationsMap} : newObservationsMap);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchObservations', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const fetchObservationsForRange = useCallback(async (startDateStr: string, endDateStr: string): Promise<DailyObservation[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('daily_observations')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date');
      if (fetchError) {
        logSupabaseError('Error fetching daily observations for range', fetchError);
        setError(fetchError);
        return null;
      }
      return data || [];
    } catch (e) {
      logSupabaseError('Unexpected error in fetchObservationsForRange', e);
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getObservation = useCallback((date: string): string | undefined => {
    return dailyObservations[date]?.observation_text || undefined;
  }, [dailyObservations]);

  const updateObservation = useCallback(async (date: string, text: string) => {
    setError(null);
    setLoading(true);
    try {
        const { data: upsertedObservation, error: upsertError } = await supabase
        .from('daily_observations')
        .upsert({ date: date, observation_text: text, updated_at: new Date().toISOString() }, { onConflict: 'date' })
        .select()
        .single();
        if (upsertError) {
        logSupabaseError('Error updating daily observation', upsertError);
        setError(upsertError);
        return null;
        }
        if (upsertedObservation) {
        setDailyObservations(prev => ({
            ...prev,
            [date]: upsertedObservation,
        }));
        }
        return upsertedObservation;
    } catch (e) {
        logSupabaseError('Unexpected error updating daily observation', e);
        setError(e);
        return null;
    } finally {
        setLoading(false);
    }
  }, []);

  return { dailyObservations, loading, error, getObservation, updateObservation, fetchObservations, fetchObservationsForRange };
}

// Daily News Store
export type DailyNewsMap = Record<string, DailyNews[]>;

export function useDailyNewsStore() {
  const [dailyNews, setDailyNews] = useState<DailyNewsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchDailyNews = useCallback(async (date?: string) => {
    if (fetchingRef.current && !date) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('daily_news').select('*').order('created_at', { ascending: true });
      if (date) {
        query = query.eq('date', date);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logSupabaseError('Error fetching daily news', fetchError);
        setError(fetchError);
      } else {
        const newNewsMapForDate: DailyNews[] = data || [];
        if (date) {
          setDailyNews(prev => ({
            ...prev,
            [date]: newNewsMapForDate,
          }));
        } else {
          // If no date, it implies fetching all news; this case might need refinement
          // For now, let's assume fetchDailyNews is always called with a date in this app context
          const allNewsGroupedByDate: DailyNewsMap = {};
          newNewsMapForDate.forEach(newsItem => {
            if (!allNewsGroupedByDate[newsItem.date]) {
              allNewsGroupedByDate[newsItem.date] = [];
            }
            allNewsGroupedByDate[newsItem.date].push(newsItem);
          });
          setDailyNews(allNewsGroupedByDate);
        }
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchDailyNews', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const fetchDailyNewsForRange = useCallback(async (startDateStr: string, endDateStr: string): Promise<DailyNews[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('daily_news')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date')
        .order('created_at', { ascending: true });
      if (fetchError) {
        logSupabaseError('Error fetching daily news for range', fetchError);
        setError(fetchError);
        return null;
      }
      return data || [];
    } catch (e) {
      logSupabaseError('Unexpected error in fetchDailyNewsForRange', e);
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);


  const addDailyNewsItem = useCallback(async (newsData: Omit<DailyNews, 'id' | 'created_at' | 'updated_at'>) => {
    setError(null);
    setLoading(true);
    try {
      const { data: newNewsItem, error: insertError } = await supabase
        .from('daily_news')
        .insert([newsData])
        .select()
        .single();

      if (insertError) {
        logSupabaseError('Error adding daily news item', insertError);
        setError(insertError);
        setLoading(false);
        return null;
      }

      if (newNewsItem) {
        // Refetch news for the specific date to update the list
        await fetchDailyNews(newNewsItem.date);
      }
      setLoading(false);
      return newNewsItem;
    } catch (e) {
      logSupabaseError('Unexpected error adding daily news item', e);
      setError(e);
      setLoading(false);
      return null;
    }
  }, [fetchDailyNews]);

  const updateDailyNewsItem = useCallback(async (newsId: string, newText: string, date: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data: updatedNews, error: updateError } = await supabase
        .from('daily_news')
        .update({ news_text: newText, updated_at: new Date().toISOString() })
        .eq('id', newsId)
        .select()
        .single();

      if (updateError) {
        logSupabaseError('Error updating daily news item', updateError);
        setError(updateError);
        return null;
      }
      if (updatedNews) {
        await fetchDailyNews(date);
      }
      return updatedNews;
    } catch (e) {
      logSupabaseError('Unexpected error updating daily news item', e);
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchDailyNews]);

  const deleteDailyNewsItem = useCallback(async (newsId: string, date: string) => {
    setError(null);
    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('daily_news')
        .delete()
        .eq('id', newsId);

      if (deleteError) {
        logSupabaseError('Error deleting daily news item', deleteError);
        setError(deleteError);
        return false;
      }
      await fetchDailyNews(date);
      return true;
    } catch (e) {
      logSupabaseError('Unexpected error deleting daily news item', e);
      setError(e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDailyNews]);


  const getNewsForDate = useCallback((date: string): DailyNews[] => {
    return dailyNews[date] || [];
  }, [dailyNews]);

  return { dailyNews, loading, error, getNewsForDate, addDailyNewsItem, fetchDailyNews, fetchDailyNewsForRange, updateDailyNewsItem, deleteDailyNewsItem };
}

// --- Flight Purposes Store ---
export function useFlightPurposesStore() {
  const [purposes, setPurposes] = useState<FlightPurpose[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchFlightPurposes = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('flight_purposes').select('*').order('name');
      if (fetchError) {
        logSupabaseError('Error fetching flight purposes', fetchError);
        setError(fetchError);
      } else {
        setPurposes(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchFlightPurposes', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchFlightPurposes();
  }, [fetchFlightPurposes]);

  const getPurposeName = useCallback((purposeId?: string | null): string => {
    if (!purposeId) return 'N/A';
    const purpose = purposes.find(p => p.id === purposeId);
    return purpose ? purpose.name : 'Desconocido';
  }, [purposes]);

  return { purposes, loading, error, fetchFlightPurposes, getPurposeName };
}


// --- Completed Glider Flights Store ---
export function useCompletedGliderFlightsStore() {
  const [completedGliderFlights, setCompletedGliderFlights] = useState<CompletedGliderFlight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchCompletedGliderFlights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('completed_glider_flights')
        .select('*')
        .order('date', { ascending: false })
        .order('departure_time', { ascending: false });

      if (fetchError) {
        logSupabaseError('Error fetching all completed glider flights', fetchError);
        setError(fetchError);
      } else {
        setCompletedGliderFlights(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchCompletedGliderFlights', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompletedGliderFlightsForRange = useCallback(async (startDate: string, endDate: string, pilotId?: string): Promise<CompletedGliderFlight[] | null> => {
    try {
      let query = supabase
        .from('completed_glider_flights')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('departure_time', { ascending: true });
      
      if (pilotId) {
        query = query.or(`pilot_id.eq.${pilotId},instructor_id.eq.${pilotId}`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logSupabaseError('Error fetching completed glider flights for range', fetchError);
        return null;
      }
      return data || [];
    } catch (e) {
      logSupabaseError('Unexpected error in fetchCompletedGliderFlightsForRange', e);
      return null;
    }
  }, []);

  const fetchCompletedGliderFlightsByAircraftForRange = useCallback(async (startDate: string, endDate: string, aircraftId: string): Promise<CompletedGliderFlight[] | null> => {
    try {
        const { data, error: fetchError } = await supabase
            .from('completed_glider_flights')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .eq('glider_aircraft_id', aircraftId)
            .order('date', { ascending: true })
            .order('departure_time', { ascending: true });
        
        if (fetchError) {
            logSupabaseError('Error fetching completed glider flights by aircraft for range', fetchError);
            return null;
        }
        return data || [];
    } catch (e) {
        logSupabaseError('Unexpected error in fetchCompletedGliderFlightsByAircraftForRange', e);
        return null;
    }
  }, []);


  const addCompletedGliderFlight = useCallback(async (flightData: Omit<CompletedGliderFlight, 'id' | 'created_at'>[]) => {
    let result = null;
    setError(null);
    setLoading(true);
    try {
      const recordsToInsert = flightData.map(fd => ({ ...fd, logbook_type: 'glider' as const }));
      const { data: newFlights, error: insertError } = await supabase
        .from('completed_glider_flights')
        .insert(recordsToInsert)
        .select();
      if (insertError) {
        logSupabaseError('Error adding completed glider flight', insertError);
        setError(insertError);
      } else {
        result = newFlights;
      }
    } catch (e) {
      logSupabaseError('Unexpected error adding completed glider flight', e);
      setError(e);
    } finally {
      setLoading(false);
    }
    return result;
  }, []);

  const updateCompletedGliderFlight = useCallback(async (flightId: string, flightData: Partial<Omit<CompletedGliderFlight, 'id' | 'created_at' | 'logbook_type' | 'auth_user_id'>>) => {
    let result = null;
    setError(null);
    setLoading(true);
    try {
      const { data: updatedFlight, error: updateError } = await supabase
        .from('completed_glider_flights')
        .update(flightData)
        .eq('id', flightId)
        .select()
        .single();
      if (updateError) {
        logSupabaseError('Error updating completed glider flight', updateError);
        setError(updateError);
      } else {
        result = updatedFlight;
      }
    } catch (e) {
      logSupabaseError('Unexpected error updating completed glider flight', e);
      setError(e);
    } finally {
      setLoading(false);
    }
    return result;
  }, []);

  const deleteCompletedGliderFlightWithRelatives = useCallback(async (flightId: string) => {
    setError(null);
    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('delete_glider_flight_and_relatives', {
        p_flight_id: flightId,
      });

      if (rpcError) {
        logSupabaseError('Error calling RPC to delete glider flight and relatives', rpcError);
        setError(rpcError);
        return false;
      }
      return true;
    } catch (e) {
      logSupabaseError('Unexpected error in deleteCompletedGliderFlightWithRelatives', e);
      setError(e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);


  return { completedGliderFlights, loading, error, addCompletedGliderFlight, updateCompletedGliderFlight, fetchCompletedGliderFlightsForRange, deleteCompletedGliderFlightWithRelatives, fetchCompletedGliderFlights, fetchCompletedGliderFlightsByAircraftForRange };
}

// --- Completed Engine Flights Store ---
export function useCompletedEngineFlightsStore() {
  const [completedEngineFlights, setCompletedEngineFlights] = useState<CompletedEngineFlight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchCompletedEngineFlights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('completed_engine_flights')
        .select('*')
        .order('date', { ascending: false })
        .order('departure_time', { ascending: false });

      if (fetchError) {
        logSupabaseError('Error fetching all completed engine flights', fetchError);
        setError(fetchError);
      } else {
        setCompletedEngineFlights(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchCompletedEngineFlights', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompletedEngineFlights();
  },[fetchCompletedEngineFlights]);

  const fetchCompletedEngineFlightsForRange = useCallback(async (startDate: string, endDate: string, pilotId?: string): Promise<CompletedEngineFlight[] | null> => {
    try {
      let query = supabase
        .from('completed_engine_flights')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('departure_time', { ascending: true });
        
      if (pilotId) {
        query = query.or(`pilot_id.eq.${pilotId},instructor_id.eq.${pilotId}`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logSupabaseError('Error fetching completed engine flights for range', fetchError);
        return null;
      }
      return data || [];
    } catch (e) {
      logSupabaseError('Unexpected error in fetchCompletedEngineFlightsForRange', e);
      return null;
    }
  }, []);

  const fetchCompletedEngineFlightsByAircraftForRange = useCallback(async (startDate: string, endDate: string, aircraftId: string): Promise<CompletedEngineFlight[] | null> => {
    try {
        const { data, error: fetchError } = await supabase
            .from('completed_engine_flights')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .eq('engine_aircraft_id', aircraftId)
            .order('date', { ascending: true })
            .order('departure_time', { ascending: true });

        if (fetchError) {
            logSupabaseError('Error fetching completed engine flights by aircraft for range', fetchError);
            return null;
        }
        return data || [];
    } catch (e) {
        logSupabaseError('Unexpected error in fetchCompletedEngineFlightsByAircraftForRange', e);
        return null;
    }
  }, []);


  const addCompletedEngineFlight = useCallback(async (flightData: Omit<CompletedEngineFlight, 'id' | 'created_at'> | Omit<CompletedEngineFlight, 'id' | 'created_at'>[]) => {
    let result = null;
    setError(null);
    setLoading(true);

    try {
        const recordsToInsert = Array.isArray(flightData) ? flightData : [flightData];
        const finalRecords = recordsToInsert.map(fd => ({ ...fd, logbook_type: 'engine' as const }));

        const { data: newFlight, error: insertError } = await supabase
            .from('completed_engine_flights')
            .insert(finalRecords)
            .select();

        if (insertError) {
            logSupabaseError('Error adding completed engine flight', insertError);
            setError(insertError);
        } else {
            result = newFlight;
        }
    } catch (e) {
        logSupabaseError('Unexpected error adding completed engine flight', e);
        setError(e);
    } finally {
        setLoading(false);
    }
    return result;
  }, []);


  const updateCompletedEngineFlight = useCallback(async (flightId: string, flightData: Partial<Omit<CompletedEngineFlight, 'id' | 'created_at' | 'logbook_type' | 'auth_user_id'>>) => {
    let result = null;
    setError(null);
    setLoading(true);
    try {
      const { data: updatedFlight, error: updateError } = await supabase
        .from('completed_engine_flights')
        .update(flightData)
        .eq('id', flightId)
        .select()
        .single();
      if (updateError) {
        logSupabaseError('Error updating completed engine flight', updateError);
        setError(updateError);
      } else {
        result = updatedFlight;
      }
    } catch (e) {
      logSupabaseError('Unexpected error updating completed engine flight', e);
      setError(e);
    } finally {
      setLoading(false);
    }
    return result;
  }, []);


  const deleteCompletedEngineFlight = useCallback(async (flightId: string) => {
    setError(null);
    setLoading(true);
    try {
      const { error: deleteError } = await supabase.from('completed_engine_flights').delete().eq('id', flightId);
      if (deleteError) {
        logSupabaseError('Error deleting completed engine flight', deleteError);
        setError(deleteError);
        return false;
      }
      return true;
    } catch (e) {
      logSupabaseError('Unexpected error deleting completed engine flight', e);
      setError(e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { completedEngineFlights, loading, error, addCompletedEngineFlight, updateCompletedEngineFlight, deleteCompletedEngineFlight, fetchCompletedEngineFlightsForRange, fetchCompletedEngineFlights, fetchCompletedEngineFlightsByAircraftForRange };
}
