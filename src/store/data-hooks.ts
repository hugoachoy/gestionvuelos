
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Pilot, PilotCategory, Aircraft, ScheduleEntry, DailyObservation } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

// Helper function for more detailed error logging
function logSupabaseError(context: string, error: any) {
  console.error(`${context}. Full error object:`, error);
  if (error && typeof error === 'object') {
    if (error.code === 'PGRST116') {
      console.warn("Hint: Error PGRST116 (JSON object requested, multiple (or no) rows returned) occurred. With RLS disabled, this might mean the record ID for an update/delete didn't exist, or an insert failed silently before the select. With RLS enabled, it means the SELECT policy after an INSERT/UPDATE prevented reading the row.");
    }
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
    // SECURITY WARNING: RLS is disabled or not yet configured for granular auth.
    // The 'auth_user_id' field should ideally be set by a secure backend process or RLS policy,
    // not directly from client input unless properly validated.
    if(pilotData.auth_user_id) {
      console.warn("SECURITY/FUNCTIONALITY NOTE: `addPilot` called with `auth_user_id`. Ensure RLS protects this if called client-side with user-provided `auth_user_id`.");
    } else {
      console.warn("NOTE: `addPilot` called without `auth_user_id`. Pilot profile will not be linked to an auth user.");
    }


    const { data: newPilot, error: insertError } = await supabase
      .from('pilots')
      .insert([pilotData])
      .select()
      .single();

    setLoading(false);
    if (insertError) {
      logSupabaseError('Error adding pilot', insertError);
      setError(insertError);
      return null;
    }
    if (newPilot) {
      await fetchPilots(); // Refetch to update list
    }
    return newPilot;
  }, [fetchPilots]);

  const updatePilot = useCallback(async (updatedPilotData: Pilot) => {
    setError(null);
    setLoading(true);
    const { id, created_at, ...updatePayload } = updatedPilotData;
    
    console.warn("SECURITY NOTE (RLS Disabled): `updatePilot` called. Fields like 'medical_expiry' are not protected by database-level security (RLS). Any client can attempt to update any pilot's data.");
    console.log('Attempting to update pilot with ID:', id, 'Payload:', updatePayload);


    const { data: updatedPilot, error: updateError } = await supabase
      .from('pilots')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    
    setLoading(false);
    if (updateError) {
      logSupabaseError('Error updating pilot', updateError);
      setError(updateError);
      return null;
    }
    if (updatedPilot) {
      await fetchPilots(); // Refetch to update list
    }
    return updatedPilot;
  }, [fetchPilots]);

  const deletePilot = useCallback(async (pilotId: string) => {
    setError(null);
    setLoading(true);
    const { error: deleteError } = await supabase.from('pilots').delete().eq('id', pilotId);
    setLoading(false);
    if (deleteError) {
      logSupabaseError('Error deleting pilot', deleteError);
      setError(deleteError);
      return false;
    }
    await fetchPilots(); // Refetch to update list
    return true;
  }, [fetchPilots]);

  const getPilotName = useCallback((pilotId: string): string => {
    const pilot = pilots.find(p => p.id === pilotId);
    return pilot ? `${pilot.first_name} ${pilot.last_name}` : 'Piloto desconocido';
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
        setCategories(DEFAULT_CATEGORIES); // Fallback to default if fetch fails
      } else {
         setCategories(data && data.length > 0 ? data : DEFAULT_CATEGORIES);
      }
    } catch (e) {
      logSupabaseError('Unexpected error in fetchCategories', e);
      setError(e);
      setCategories(DEFAULT_CATEGORIES); // Fallback on unexpected error
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []); // No dependencies, DEFAULT_CATEGORIES is stable

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = useCallback(async (categoryData: Omit<PilotCategory, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true);
    const { data: newCategory, error: insertError } = await supabase
      .from('pilot_categories')
      .insert([categoryData])
      .select()
      .single();
    setLoading(false);
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
    setError(null);
    setLoading(true);
    const { id, created_at, ...updatePayload } = updatedCategoryData;
    const { data: updatedCategory, error: updateError } = await supabase
      .from('pilot_categories')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    setLoading(false);
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
    setError(null);
    setLoading(true);
    const { error: deleteError } = await supabase.from('pilot_categories').delete().eq('id', categoryId);
    setLoading(false);
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
    const { data: newAircraft, error: insertError } = await supabase
      .from('aircraft')
      .insert([aircraftData])
      .select()
      .single();
    setLoading(false);
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
    setError(null);
    setLoading(true);
    const { id, created_at, ...updatePayload } = updatedAircraftData;
    const { data: updatedAircraft, error: updateError } = await supabase
      .from('aircraft')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    setLoading(false);
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
    setError(null);
    setLoading(true);
    const { error: deleteError } = await supabase.from('aircraft').delete().eq('id', aircraftId);
    setLoading(false);
    if (deleteError) {
      logSupabaseError('Error deleting aircraft', deleteError);
      setError(deleteError);
      return false;
    }
    await fetchAircraft();
    return true;
  }, [fetchAircraft]);

  const getAircraftName = useCallback((aircraftId?: string | null): string => {
    if (!aircraftId) return 'N/A';
    const ac = aircraft.find(a => a.id === aircraftId);
    return ac ? ac.name : 'Aeronave desconocida';
  }, [aircraft]);

  return { aircraft, loading, error, addAircraft, updateAircraft, deleteAircraft, getAircraftName, fetchAircraft };
}

// Schedule Store
export function useScheduleStore() {
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchScheduleEntries = useCallback(async (date?: string) => {
    if (fetchingRef.current && !date) return; // Allow refetch if specific date changes
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('schedule_entries').select('*');
      if (date) {
        query = query.eq('date', date);
      }
      // The sorting is now handled in ScheduleClient's useMemo, so keep it simple here
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
        return null;
      }
      return data || [];
    } catch (e) {
      logSupabaseError('Unexpected error in fetchScheduleEntriesForRange', e);
      return null;
    }
  }, []);

  const addScheduleEntry = useCallback(async (entryData: Omit<ScheduleEntry, 'id' | 'created_at'>) => {
    setError(null);
    setLoading(true);
    const { data: newEntry, error: insertError } = await supabase
      .from('schedule_entries')
      .insert([entryData])
      .select()
      .single();
    setLoading(false);
    if (insertError) {
      logSupabaseError('Error adding schedule entry', insertError);
      setError(insertError);
      return null;
    }
    if (newEntry) {
      await fetchScheduleEntries(newEntry.date);
    }
    return newEntry;
  }, [fetchScheduleEntries]);

  const updateScheduleEntry = useCallback(async (updatedEntryData: ScheduleEntry) => {
    setError(null);
    setLoading(true);
    const { created_at, id, ...updatePayload } = updatedEntryData;
    const { data: updatedEntry, error: updateError } = await supabase
      .from('schedule_entries')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    setLoading(false);
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
    setError(null);
    setLoading(true);
    const { error: deleteError } = await supabase.from('schedule_entries').delete().eq('id', entryId);
    setLoading(false);
    if (deleteError) {
      logSupabaseError('Error deleting schedule entry', deleteError);
      setError(deleteError);
      return false;
    }
    await fetchScheduleEntries(entryDate);
    return true;
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
    try {
      const { data, error: fetchError } = await supabase
        .from('daily_observations')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date');
      if (fetchError) {
        logSupabaseError('Error fetching daily observations for range', fetchError);
        return null;
      }
      return data || [];
    } catch (e) {
      logSupabaseError('Unexpected error in fetchObservationsForRange', e);
      return null;
    }
  }, []);

  const getObservation = useCallback((date: string): string | undefined => {
    return dailyObservations[date]?.observation_text || undefined;
  }, [dailyObservations]);

  const updateObservation = useCallback(async (date: string, text: string) => {
    setError(null);
    setLoading(true);
    const { data: upsertedObservation, error: upsertError } = await supabase
      .from('daily_observations')
      .upsert({ date: date, observation_text: text, updated_at: new Date().toISOString() }, { onConflict: 'date' })
      .select()
      .single();
    setLoading(false);
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
  }, []);

  return { dailyObservations, loading, error, getObservation, updateObservation, fetchObservations, fetchObservationsForRange };
}
