
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Pilot, PilotCategory, Aircraft, ScheduleEntry, DailyObservation, DailyNews, CompletedGliderFlight, CompletedEngineFlight, CompletedFlight } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

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
    setError(null);
    setLoading(true);
    const { id, created_at, ...updatePayload } = updatedPilotData;

    const { error: supabaseUpdateError } = await supabase
      .from('pilots')
      .update(updatePayload)
      .eq('id', id);

    if (supabaseUpdateError) {
      logSupabaseError('Error updating pilot (during Supabase update operation)', supabaseUpdateError);
      setError(supabaseUpdateError);
      setLoading(false);
      return null;
    }
    
    await fetchPilots(); 
    setLoading(false);
    return updatedPilotData; 
  }, [fetchPilots]);

  const deletePilot = useCallback(async (pilotId: string) => {
    setError(null);
    setLoading(true);
    try {
      const { error: deleteError } = await supabase.from('pilots').delete().eq('id', pilotId);
      if (deleteError) {
        logSupabaseError('Error deleting pilot', deleteError);
        setError(deleteError);
        return false;
      }
      await fetchPilots(); 
      return true;
    } catch (e) {
      logSupabaseError('Unexpected error deleting pilot', e);
      setError(e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPilots]);

  const getPilotName = useCallback((pilotId: string): string => {
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

  const DEFAULT_CATEGORIES: PilotCategory[] = [
    { id: 'static-cat-instructor', name: 'Instructor', created_at: new Date().toISOString() },
    { id: 'static-cat-tow-pilot', name: 'Remolcador', created_at: new Date().toISOString() },
    { id: 'static-cat-glider-pilot', name: 'Piloto planeador', created_at: new Date().toISOString() },
  ];

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
        setCategories(DEFAULT_CATEGORIES); 
      } else {
         setCategories(data && data.length > 0 ? data : DEFAULT_CATEGORIES);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchCategories', e);
      setError(e);
      setCategories(DEFAULT_CATEGORIES); 
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

// Aircraft Store
export function useAircraftStore() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchAircraft = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('aircraft').select('*').order('name');
      if (fetchError) {
        logSupabaseError('Error fetching aircraft', fetchError);
        setError(fetchError);
      } else {
        setAircraft(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchAircraft', e);
      setError(e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchAircraft();
  }, [fetchAircraft]);

  const addAircraft = useCallback(async (aircraftData: Omit<Aircraft, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true);
    try {
        const { data: newAircraft, error: insertError } = await supabase
        .from('aircraft')
        .insert([aircraftData])
        .select()
        .single();
        if (insertError) {
        logSupabaseError('Error adding aircraft', insertError);
        setError(insertError);
        return null;
        }
        if (newAircraft) {
        await fetchAircraft();
        }
        return newAircraft;
    } catch (e) {
        logSupabaseError('Unexpected error adding aircraft', e);
        setError(e);
        return null;
    } finally {
        setLoading(false);
    }
  }, [fetchAircraft]);

  const updateAircraft = useCallback(async (updatedAircraftData: Aircraft) => {
    setError(null);
    setLoading(true);
    try {
        const { id, created_at, ...updatePayload } = updatedAircraftData;
        const { data: updatedAircraft, error: updateError } = await supabase
        .from('aircraft')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
        if (updateError) {
        logSupabaseError('Error updating aircraft', updateError);
        setError(updateError);
        return null;
        }
        if (updatedAircraft) {
        await fetchAircraft();
        }
        return updatedAircraft;
    } catch (e) {
        logSupabaseError('Unexpected error updating aircraft', e);
        setError(e);
        return null;
    } finally {
        setLoading(false);
    }
  }, [fetchAircraft]);

  const deleteAircraft = useCallback(async (aircraftId: string) => {
    setError(null);
    setLoading(true);
    try {
        const { error: deleteError } = await supabase.from('aircraft').delete().eq('id', aircraftId);
        if (deleteError) {
        logSupabaseError('Error deleting aircraft', deleteError);
        setError(deleteError);
        return false;
        }
        await fetchAircraft();
        return true;
    } catch (e) {
        logSupabaseError('Unexpected error deleting aircraft', e);
        setError(e);
        return false;
    } finally {
        setLoading(false);
    }
  }, [fetchAircraft]);

  const getAircraftName = useCallback((aircraftId?: string | null): string => {
    if (!aircraftId) return 'N/A';
    const ac = aircraft.find(a => a.id === aircraftId);
    return ac ? ac.name : 'Aeronave no encontrada';
  }, [aircraft]);

  return { aircraft, loading, error, addAircraft, updateAircraft, deleteAircraft, getAircraftName, fetchAircraft };
}

// Schedule Store
export function useScheduleStore() {
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
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

  const addScheduleEntry = useCallback(async (entryData: Omit<ScheduleEntry, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true);
    try {
        const { data: newEntry, error: insertError } = await supabase
        .from('schedule_entries')
        .insert([entryData])
        .select()
        .single();
        if (insertError) {
        logSupabaseError('Error adding schedule entry', insertError);
        setError(insertError);
        return null;
        }
        if (newEntry) {
        await fetchScheduleEntries(newEntry.date);
        }
        return newEntry;
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

  const cleanupOldScheduleEntries = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thresholdDate = format(thirtyDaysAgo, 'yyyy-MM-dd');
      const { error: deleteError, count } = await supabase
        .from('schedule_entries')
        .delete({ count: 'exact'})
        .lt('date', thresholdDate);
      if (deleteError) {
        logSupabaseError('Error cleaning up old schedule entries', deleteError);
        return { success: false, error: deleteError, count: 0 };
      }
      return { success: true, count: count ?? 0 };
    } catch (e) {
      logSupabaseError('Unexpected error during old schedule entry cleanup', e);
      return { success: false, error: e, count: 0 };
    }
  }, []);

  return { scheduleEntries, loading, error, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, fetchScheduleEntries, cleanupOldScheduleEntries, fetchScheduleEntriesForRange };
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


// --- Completed Glider Flights Store ---
export function useCompletedGliderFlightsStore() {
  const [completedGliderFlights, setCompletedGliderFlights] = useState<CompletedGliderFlight[]>([]);
  const [loading, setLoading] = useState(false); // Loading specific to add/update operations
  const [error, setError] = useState<any>(null);
  const fetchingListRef = useRef(false); // For list fetching operations

  const fetchCompletedGliderFlights = useCallback(async (filters?: { date?: string; pilotId?: string }) => {
    if (fetchingListRef.current) return;
    fetchingListRef.current = true;
    setLoading(true); 
    setError(null);
    try {
      let query = supabase.from('completed_glider_flights').select('*').order('date', { ascending: false }).order('departure_time', { ascending: false });
      if (filters?.date) query = query.eq('date', filters.date);
      if (filters?.pilotId) query = query.eq('pilot_id', filters.pilotId);
      
      const { data, error: fetchError } = await query;
      if (fetchError) {
        logSupabaseError('Error fetching completed glider flights', fetchError);
        setError(fetchError);
      } else {
        setCompletedGliderFlights(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error fetching completed glider flights', e);
      setError(e);
    } finally {
      setLoading(false); 
      fetchingListRef.current = false;
    }
  }, []);

  const addCompletedGliderFlight = useCallback(async (flightData: Omit<CompletedGliderFlight, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true); 
    try {
      const { data: newFlight, error: insertError } = await supabase
        .from('completed_glider_flights')
        .insert([{ ...flightData, logbook_type: 'glider' }])
        .select()
        .single();
      if (insertError) {
        logSupabaseError('Error adding completed glider flight', insertError);
        setError(insertError);
        return null;
      }
      return newFlight;
    } catch (e) {
      logSupabaseError('Unexpected error adding completed glider flight', e);
      setError(e);
      return null;
    } finally {
      setLoading(false); 
    }
  }, []); 

  return { completedGliderFlights, loading, error, fetchCompletedGliderFlights, addCompletedGliderFlight };
}

// --- Completed Engine Flights Store ---
export function useCompletedEngineFlightsStore() {
  const [completedEngineFlights, setCompletedEngineFlights] = useState<CompletedEngineFlight[]>([]);
  const [loading, setLoading] = useState(false); // Loading specific to add/update operations
  const [error, setError] = useState<any>(null);
  const fetchingListRef = useRef(false); // For list fetching operations

  const fetchCompletedEngineFlights = useCallback(async (filters?: { date?: string; pilotId?: string }) => {
    if (fetchingListRef.current) return;
    fetchingListRef.current = true;
    setLoading(true);  
    setError(null);
    try {
      let query = supabase.from('completed_engine_flights').select('*').order('date', { ascending: false }).order('departure_time', { ascending: false });
      if (filters?.date) query = query.eq('date', filters.date);
      if (filters?.pilotId) query = query.eq('pilot_id', filters.pilotId);

      const { data, error: fetchError } = await query;
      if (fetchError) {
        logSupabaseError('Error fetching completed engine flights', fetchError);
        setError(fetchError);
      } else {
        setCompletedEngineFlights(data || []);
      }
    } catch (e) {
      logSupabaseError('Unexpected error fetching completed engine flights', e);
      setError(e);
    } finally {
      setLoading(false); 
      fetchingListRef.current = false;
    }
  }, []);

  const addCompletedEngineFlight = useCallback(async (flightData: Omit<CompletedEngineFlight, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true); 
    try {
      const { data: newFlight, error: insertError } = await supabase
        .from('completed_engine_flights')
        .insert([{ ...flightData, logbook_type: 'engine' }])
        .select()
        .single();
      if (insertError) {
        logSupabaseError('Error adding completed engine flight', insertError);
        setError(insertError);
        return null;
      }
      return newFlight;
    } catch (e) {
      logSupabaseError('Unexpected error adding completed engine flight', e);
      setError(e);
      return null;
    } finally {
      setLoading(false); 
    }
  }, []);

  return { completedEngineFlights, loading, error, fetchCompletedEngineFlights, addCompletedEngineFlight };
}

