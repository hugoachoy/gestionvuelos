
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
    const { data, error: fetchError } = await supabase.from('pilots').select('*').order('created_at', { ascending: false });
    if (fetchError) {
      logSupabaseError('Error fetching pilots', fetchError);
      setError(fetchError);
    } else {
      setPilots(data || []);
    }
    setLoading(false);
    fetchingRef.current = false;
  }, []);

  useEffect(() => {
    fetchPilots();
  }, [fetchPilots]);

  const addPilot = useCallback(async (pilotData: Omit<Pilot, 'id' | 'created_at'>) => {
    setLoading(true);
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
      setPilots(prev => [newPilot, ...prev].sort((a, b) => (a.created_at && b.created_at ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : 0)));
    }
    return newPilot;
  }, []);

  const updatePilot = useCallback(async (updatedPilotData: Pilot) => {
    setLoading(true);
    const { id, created_at, ...updatePayload } = updatedPilotData;
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
      setPilots(prev => prev.map(p => p.id === updatedPilot.id ? updatedPilot : p));
    }
    return updatedPilot;
  }, []);

  const deletePilot = useCallback(async (pilotId: string) => {
    setLoading(true);
    const { error: deleteError } = await supabase.from('pilots').delete().eq('id', pilotId);
    setLoading(false);

    if (deleteError) {
      logSupabaseError('Error deleting pilot', deleteError);
      setError(deleteError);
      return false;
    }
    setPilots(prev => prev.filter(p => p.id !== pilotId));
    return true;
  }, []);
  
  const getPilotName = useCallback((pilotId: string): string => {
    const pilot = pilots.find(p => p.id === pilotId);
    return pilot ? `${pilot.first_name} ${pilot.last_name}` : 'Piloto con ID no encontrado';
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
    const { data, error: fetchError } = await supabase.from('pilot_categories').select('*').order('name');
    if (fetchError) {
      logSupabaseError('Error fetching pilot categories', fetchError);
      setError(fetchError);
      setCategories(DEFAULT_CATEGORIES); 
    } else {
      setCategories(data && data.length > 0 ? data : DEFAULT_CATEGORIES);
    }
    setLoading(false);
    fetchingRef.current = false;
  }, []); 

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = useCallback(async (categoryData: Omit<PilotCategory, 'id' | 'created_at'>) => {
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
      setCategories(prev => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return newCategory;
  }, []);

  const updateCategory = useCallback(async (updatedCategoryData: PilotCategory) => {
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
      setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c).sort((a,b) => a.name.localeCompare(b.name)));
    }
    return updatedCategory;
  }, []);

  const deleteCategory = useCallback(async (categoryId: string) => {
    setLoading(true);
    const { error: deleteError } = await supabase.from('pilot_categories').delete().eq('id', categoryId);
    setLoading(false);

    if (deleteError) {
      logSupabaseError('Error deleting pilot category', deleteError);
      setError(deleteError);
      return false;
    }
    setCategories(prev => prev.filter(c => c.id !== categoryId));
    return true;
  }, []);

  const getCategoryName = useCallback((categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Categoría con ID no encontrado';
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
    const { data, error: fetchError } = await supabase.from('aircraft').select('*').order('name');
    if (fetchError) {
      logSupabaseError('Error fetching aircraft', fetchError);
      setError(fetchError);
    } else {
      setAircraft(data || []);
    }
    setLoading(false);
    fetchingRef.current = false;
  }, []);

  useEffect(() => {
    fetchAircraft();
  }, [fetchAircraft]);

  const addAircraft = useCallback(async (aircraftData: Omit<Aircraft, 'id' | 'created_at'>) => {
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
      setAircraft(prev => [...prev, newAircraft].sort((a,b) => a.name.localeCompare(b.name)));
    }
    return newAircraft;
  }, []);

  const updateAircraft = useCallback(async (updatedAircraftData: Aircraft) => {
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
      setAircraft(prev => prev.map(a => a.id === updatedAircraft.id ? updatedAircraft : a).sort((a,b) => a.name.localeCompare(b.name)));
    }
    return updatedAircraft;
  }, []);

  const deleteAircraft = useCallback(async (aircraftId: string) => {
    setLoading(true);
    const { error: deleteError } = await supabase.from('aircraft').delete().eq('id', aircraftId);
    setLoading(false);

    if (deleteError) {
      logSupabaseError('Error deleting aircraft', deleteError);
      setError(deleteError);
      return false;
    }
    setAircraft(prev => prev.filter(a => a.id !== aircraftId));
    return true;
  }, []);
  
  const getAircraftName = useCallback((aircraftId?: string): string => {
    if (!aircraftId) return 'N/A';
    const ac = aircraft.find(a => a.id === aircraftId);
    return ac ? ac.name : 'Aeronave con ID no encontrado';
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
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
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
    setLoading(false);
    fetchingRef.current = false;
  }, []);

  useEffect(() => {
    // Initial fetch for all entries, or based on an initial date if provided elsewhere
    // For now, let's assume we might want to fetch all initially or rely on component to specify date
    // fetchScheduleEntries(); // Consider if an initial fetch of *all* entries is desired or should wait for a date.
  }, []);


  const addScheduleEntry = useCallback(async (entryData: Omit<ScheduleEntry, 'id' | 'created_at'>) => {
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
      fetchScheduleEntries(newEntry.date); 
    }
    return newEntry;
  }, [fetchScheduleEntries]);

  const updateScheduleEntry = useCallback(async (updatedEntryData: ScheduleEntry) => {
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
      fetchScheduleEntries(updatedEntry.date); 
    }
    return updatedEntry;
  }, [fetchScheduleEntries]);

  const deleteScheduleEntry = useCallback(async (entryId: string, entryDate: string) => {
    setLoading(true);
    const { error: deleteError } = await supabase.from('schedule_entries').delete().eq('id', entryId);
    setLoading(false);

    if (deleteError) {
      logSupabaseError('Error deleting schedule entry', deleteError);
      setError(deleteError);
      return false;
    }
    fetchScheduleEntries(entryDate); 
    return true;
  }, [fetchScheduleEntries]);

  return { scheduleEntries, loading, error, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, fetchScheduleEntries };
}


// Daily Observations Store
export type DailyObservationsMap = Record<string, DailyObservation>; 

export function useDailyObservationsStore() {
  const [dailyObservations, setDailyObservations] = useState<DailyObservationsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const fetchingRef = useRef(false);

  const fetchObservations = useCallback(async (date?: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
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
      // If a specific date is fetched, merge it. Otherwise, replace all.
      setDailyObservations(prev => date ? {...prev, ...newObservationsMap} : newObservationsMap);
    }
    setLoading(false);
    fetchingRef.current = false;
  }, []);

  useEffect(() => {
    // fetchObservations(); // Consider if an initial fetch of *all* observations is desired.
  }, []);

  const getObservation = useCallback((date: string): string | undefined => {
    return dailyObservations[date]?.observation_text || undefined;
  }, [dailyObservations]);

  const updateObservation = useCallback(async (date: string, text: string) => {
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

  return { dailyObservations, loading, error, getObservation, updateObservation, fetchObservations };
}

    