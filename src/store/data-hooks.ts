
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Pilot, PilotCategory, Aircraft, ScheduleEntry, DailyObservation } from '@/types';
import { supabase } from '@/lib/supabaseClient';

// Pilots Store
export function usePilotsStore() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchPilots = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('pilots').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching pilots:', error);
      setError(error);
    } else {
      setPilots(data || []);
    }
    setLoading(false);
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
      console.error('Error adding pilot:', insertError);
      setError(insertError);
      return null;
    }
    if (newPilot) {
      setPilots(prev => [newPilot, ...prev]);
    }
    return newPilot;
  }, []);

  const updatePilot = useCallback(async (updatedPilotData: Pilot) => {
    setLoading(true);
    const { data: updatedPilot, error: updateError } = await supabase
      .from('pilots')
      .update(updatedPilotData)
      .eq('id', updatedPilotData.id)
      .select()
      .single();
    setLoading(false);

    if (updateError) {
      console.error('Error updating pilot:', updateError);
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
      console.error('Error deleting pilot:', deleteError);
      setError(deleteError);
      return false;
    }
    setPilots(prev => prev.filter(p => p.id !== pilotId));
    return true;
  }, []);
  
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
  
  // Static default categories (ensure these IDs match what you might seed in DB)
  // These are only used if fetched categories are empty, as a fallback.
  // Ideally, these should be seeded directly in Supabase.
  const DEFAULT_CATEGORIES: PilotCategory[] = [
    { id: 'static-cat-tow-pilot', name: 'Piloto remolcador' },
    { id: 'static-cat-instructor', name: 'Instructor' },
    { id: 'static-cat-glider-pilot', name: 'Piloto planeador' },
  ];


  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('pilot_categories').select('*').order('name');
    if (fetchError) {
      console.error('Error fetching categories:', fetchError);
      setError(fetchError);
      setCategories(DEFAULT_CATEGORIES); // Fallback to defaults on error
    } else {
      setCategories(data && data.length > 0 ? data : DEFAULT_CATEGORIES);
    }
    setLoading(false);
  }, []); // DEFAULT_CATEGORIES dependency removed as it's static

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
      console.error('Error adding category:', insertError);
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
    const { data: updatedCategory, error: updateError } = await supabase
      .from('pilot_categories')
      .update({ name: updatedCategoryData.name })
      .eq('id', updatedCategoryData.id)
      .select()
      .single();
    setLoading(false);

    if (updateError) {
      console.error('Error updating category:', updateError);
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
      console.error('Error deleting category:', deleteError);
      setError(deleteError);
      return false;
    }
    setCategories(prev => prev.filter(c => c.id !== categoryId));
    return true;
  }, []);

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

  const fetchAircraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('aircraft').select('*').order('name');
    if (fetchError) {
      console.error('Error fetching aircraft:', fetchError);
      setError(fetchError);
    } else {
      setAircraft(data || []);
    }
    setLoading(false);
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
      console.error('Error adding aircraft:', insertError);
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
    const { data: updatedAircraft, error: updateError } = await supabase
      .from('aircraft')
      .update({ name: updatedAircraftData.name, type: updatedAircraftData.type })
      .eq('id', updatedAircraftData.id)
      .select()
      .single();
    setLoading(false);

    if (updateError) {
      console.error('Error updating aircraft:', updateError);
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
      console.error('Error deleting aircraft:', deleteError);
      setError(deleteError);
      return false;
    }
    setAircraft(prev => prev.filter(a => a.id !== aircraftId));
    return true;
  }, []);
  
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // Fetching all entries. For larger datasets, consider filtering by date range.
  const fetchScheduleEntries = useCallback(async (date?: string) => {
    setLoading(true);
    setError(null);
    let query = supabase.from('schedule_entries').select('*');
    if (date) {
      query = query.eq('date', date);
    }
    query = query.order('date').order('start_time');
    
    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching schedule entries:', fetchError);
      setError(fetchError);
    } else {
      setScheduleEntries(data || []);
    }
    setLoading(false);
  }, []);

  // Initial fetch (can be refined to fetch for a default date range or current date)
  useEffect(() => {
    fetchScheduleEntries(); // Fetches all initially
  }, [fetchScheduleEntries]);


  const addScheduleEntry = useCallback(async (entryData: Omit<ScheduleEntry, 'id' | 'created_at'>) => {
    setLoading(true);
    const { data: newEntry, error: insertError } = await supabase
      .from('schedule_entries')
      .insert([entryData])
      .select()
      .single();
    setLoading(false);

    if (insertError) {
      console.error('Error adding schedule entry:', insertError);
      setError(insertError);
      return null;
    }
    if (newEntry) {
      // Instead of just prepending, refetch for the specific date to maintain order or merge carefully
      // For simplicity now, just adding to local state - consider implications on sorting.
      // A full refetch for the day or a smart merge might be better.
      setScheduleEntries(prev => [...prev, newEntry]); 
      fetchScheduleEntries(newEntry.date); // Refetch for the day of the new entry
    }
    return newEntry;
  }, [fetchScheduleEntries]);

  const updateScheduleEntry = useCallback(async (updatedEntryData: ScheduleEntry) => {
    setLoading(true);
    // Ensure we only send fields that exist on the table, excluding client-side ones or ones managed by DB
    const { created_at, id, ...updatePayload } = updatedEntryData;

    const { data: updatedEntry, error: updateError } = await supabase
      .from('schedule_entries')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    setLoading(false);

    if (updateError) {
      console.error('Error updating schedule entry:', updateError);
      setError(updateError);
      return null;
    }
    if (updatedEntry) {
      setScheduleEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
      fetchScheduleEntries(updatedEntry.date); // Refetch for the day of the updated entry
    }
    return updatedEntry;
  }, [fetchScheduleEntries]);

  const deleteScheduleEntry = useCallback(async (entryId: string, entryDate: string) => {
    setLoading(true);
    const { error: deleteError } = await supabase.from('schedule_entries').delete().eq('id', entryId);
    setLoading(false);

    if (deleteError) {
      console.error('Error deleting schedule entry:', deleteError);
      setError(deleteError);
      return false;
    }
    setScheduleEntries(prev => prev.filter(e => e.id !== entryId));
    fetchScheduleEntries(entryDate); // Refetch for the day of the deleted entry
    return true;
  }, [fetchScheduleEntries]);

  return { scheduleEntries, loading, error, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, fetchScheduleEntries };
}


// Daily Observations Store
export type DailyObservationsMap = Record<string, DailyObservation>; // Key: YYYY-MM-DD, Value: observation object

export function useDailyObservationsStore() {
  const [dailyObservations, setDailyObservations] = useState<DailyObservationsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchObservations = useCallback(async (date?: string) => {
    setLoading(true);
    setError(null);
    let query = supabase.from('daily_observations').select('*');
    if (date) {
      query = query.eq('date', date);
    }
    const { data, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('Error fetching daily observations:', fetchError);
      setError(fetchError);
    } else {
      const newObservationsMap: DailyObservationsMap = {};
      (data || []).forEach(obs => {
        newObservationsMap[obs.date] = obs;
      });
      // If fetching for a specific date, merge, otherwise replace
      setDailyObservations(prev => date ? {...prev, ...newObservationsMap} : newObservationsMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchObservations(); // Fetch all initially
  }, [fetchObservations]);

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
      console.error('Error updating observation:', upsertError);
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
