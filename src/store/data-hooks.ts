
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Pilot, PilotCategory, Aircraft, ScheduleEntry, DailyObservation } from '@/types';
import { supabase } from '@/lib/supabaseClient';

// Helper function for more detailed error logging
function logSupabaseError(context: string, error: any) {
  console.error(`${context}. Full error object:`, error);
  if (error && typeof error === 'object') {
    if ('message' in error) console.error('Supabase error message:', error.message);
    if ('details' in error) console.error('Supabase error details:', error.details);
    if ('hint' in error) console.error('Supabase error hint:', error.hint);
    if ('code' in error) console.error('Supabase error code:', error.code);
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
      const { data, error: fetchError } = await supabase.from('pilots').select('*').order('created_at', { ascending: false });
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
    // setLoading(true); // Loading state for individual actions can be added if needed
    const { data: newPilot, error: insertError } = await supabase
      .from('pilots')
      .insert([pilotData])
      .select()
      .single();
    // setLoading(false);

    if (insertError) {
      logSupabaseError('Error adding pilot', insertError);
      setError(insertError);
      return null;
    }
    if (newPilot) {
      // Fetch again to ensure UI consistency, or optimistically update
      await fetchPilots(); 
      // Optimistic update (alternative to re-fetching):
      // setPilots(prev => [newPilot, ...prev].sort((a, b) => (a.created_at && b.created_at ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : 0)));
    }
    return newPilot;
  }, [fetchPilots]);

  const updatePilot = useCallback(async (updatedPilotData: Pilot) => {
    // setLoading(true);
    const { id, created_at, ...updatePayload } = updatedPilotData;
    const { data: updatedPilot, error: updateError } = await supabase
      .from('pilots')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    // setLoading(false);

    if (updateError) {
      logSupabaseError('Error updating pilot', updateError);
      setError(updateError);
      return null;
    }
    if (updatedPilot) {
      await fetchPilots();
      // Optimistic update:
      // setPilots(prev => prev.map(p => p.id === updatedPilot.id ? updatedPilot : p));
    }
    return updatedPilot;
  }, [fetchPilots]);

  const deletePilot = useCallback(async (pilotId: string) => {
    // setLoading(true);
    const { error: deleteError } = await supabase.from('pilots').delete().eq('id', pilotId);
    // setLoading(false);

    if (deleteError) {
      logSupabaseError('Error deleting pilot', deleteError);
      setError(deleteError);
      return false;
    }
    await fetchPilots();
    // Optimistic update:
    // setPilots(prev => prev.filter(p => p.id !== pilotId));
    return true;
  }, [fetchPilots]);
  
  const getPilotName = useCallback((pilotId: string): string => {
    const pilot = pilots.find(p => p.id === pilotId);
    return pilot ? `${pilot.first_name} ${pilot.last_name}` : 'Piloto Desconocido';
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
    { id: 'static-cat-tow-pilot', name: 'Piloto remolcador', created_at: new Date().toISOString() },
    { id: 'static-cat-instructor', name: 'Instructor', created_at: new Date().toISOString() },
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
  }, [fetchCategories]);

  const updateCategory = useCallback(async (updatedCategoryData: PilotCategory) => {
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
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    const { error: deleteError } = await supabase.from('pilot_categories').delete().eq('id', categoryId);

    if (deleteError) {
      logSupabaseError('Error deleting pilot category', deleteError);
      setError(deleteError);
      return false;
    }
    await fetchCategories();
    return true;
  }, [fetchCategories]);

  const getCategoryName = useCallback((categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Categoría Desconocida';
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
  }, [fetchAircraft]);

  const updateAircraft = useCallback(async (updatedAircraftData: Aircraft) => {
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
  }, [fetchAircraft]);

  const deleteAircraft = useCallback(async (aircraftId: string) => {
    const { error: deleteError } = await supabase.from('aircraft').delete().eq('id', aircraftId);

    if (deleteError) {
      logSupabaseError('Error deleting aircraft', deleteError);
      setError(deleteError);
      return false;
    }
    await fetchAircraft();
    return true;
  }, [fetchAircraft]);
  
  const getAircraftName = useCallback((aircraftId?: string): string => {
    if (!aircraftId) return 'N/A';
    const ac = aircraft.find(a => a.id === aircraftId);
    return ac ? ac.name : 'Aeronave Desconocida';
  }, [aircraft]);

  return { aircraft, loading, error, addAircraft, updateAircraft, deleteAircraft, getAircraftName, fetchAircraft };
}

// Schedule Store
export function useScheduleStore() {
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true); // This loading is for the list of entries
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchScheduleEntries = useCallback(async (date?: string) => {
    if (fetchingRef.current && date) { // Only block if fetching for a specific date is in progress
      // If date is undefined, it might be a general refresh, allow it or handle differently.
      // For now, let's allow general refresh to proceed but specific date fetches are guarded.
      const currentFetchIsForSpecificDate = !!date;
      if(currentFetchIsForSpecificDate) return;
    }

    fetchingRef.current = true;
    setLoading(true); // Set loading true when a fetch starts
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
      setLoading(false); // Set loading false when fetch completes
      fetchingRef.current = false;
    }
  }, []);


  const addScheduleEntry = useCallback(async (entryData: Omit<ScheduleEntry, 'id' | 'created_at'>) => {
    // setError(null); // Clear previous errors for this specific action
    const { data: newEntry, error: insertError } = await supabase
      .from('schedule_entries')
      .insert([entryData])
      .select()
      .single();

    if (insertError) {
      logSupabaseError('Error adding schedule entry', insertError);
      setError(insertError); // Set error specific to this store
      return null;
    }
    if (newEntry) {
      await fetchScheduleEntries(newEntry.date); 
    }
    return newEntry;
  }, [fetchScheduleEntries]);

  const updateScheduleEntry = useCallback(async (updatedEntryData: ScheduleEntry) => {
    // setError(null);
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
  }, [fetchScheduleEntries]);

  const deleteScheduleEntry = useCallback(async (entryId: string, entryDate: string) => {
    // setError(null);
    const { error: deleteError } = await supabase.from('schedule_entries').delete().eq('id', entryId);

    if (deleteError) {
      logSupabaseError('Error deleting schedule entry', deleteError);
      setError(deleteError);
      return false;
    }
    await fetchScheduleEntries(entryDate); 
    return true;
  }, [fetchScheduleEntries]);

  return { scheduleEntries, loading, error, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, fetchScheduleEntries };
}


// Daily Observations Store
export type DailyObservationsMap = Record<string, DailyObservation>; 

export function useDailyObservationsStore() {
  const [dailyObservations, setDailyObservations] = useState<DailyObservationsMap>({});
  const [loading, setLoading] = useState(true); // Loading for observations
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchObservations = useCallback(async (date?: string) => {
     if (fetchingRef.current && date) {
       const currentFetchIsForSpecificDate = !!date;
       if(currentFetchIsForSpecificDate) return;
     }
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

  const getObservation = useCallback((date: string): string | undefined => {
    return dailyObservations[date]?.observation_text || undefined;
  }, [dailyObservations]);

  const updateObservation = useCallback(async (date: string, text: string) => {
    // setLoading(true); // Optional: separate loading state for this action
    // setError(null);
    const { data: upsertedObservation, error: upsertError } = await supabase
      .from('daily_observations')
      .upsert({ date: date, observation_text: text, updated_at: new Date().toISOString() }, { onConflict: 'date' })
      .select()
      .single();
    // setLoading(false);

    if (upsertError) {
      logSupabaseError('Error updating daily observation', upsertError);
      setError(upsertError); // Set error specific to this store
      return null;
    }
    if (upsertedObservation) {
      // Optimistically update or re-fetch if needed, though upsert gives the new data.
      setDailyObservations(prev => ({
        ...prev,
        [date]: upsertedObservation,
      }));
    }
    return upsertedObservation;
  }, []); // Removed fetchObservations from deps as it's not directly needed after upsert

  return { dailyObservations, loading, error, getObservation, updateObservation, fetchObservations };
}

    