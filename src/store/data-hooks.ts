
"use client";

import type { Pilot, PilotCategory, Aircraft, ScheduleEntry } from '@/types';
import useLocalStorageState from '@/hooks/use-local-storage-state';
import { useCallback } from 'react'; 

const generateId = () => crypto.randomUUID();

// Define default pilot categories with STABLE, HARDCODED IDs
const DEFAULT_PILOT_CATEGORIES: PilotCategory[] = [
  { id: 'static-cat-tow-pilot', name: 'Piloto remolcador' },
  { id: 'static-cat-instructor', name: 'Instructor' },
  { id: 'static-cat-glider-pilot', name: 'Piloto planeador' },
];

// Pilots Store
export function usePilotsStore() {
  const [pilots, setPilots] = useLocalStorageState<Pilot[]>('pilots', []);

  const addPilot = useCallback((pilotData: Omit<Pilot, 'id' | 'categoryIds'> & { categoryIds?: string[] }) => {
    const newPilot: Pilot = { ...pilotData, categoryIds: pilotData.categoryIds || [], id: generateId() };
    setPilots(prev => [...prev, newPilot]);
    return newPilot;
  }, [setPilots]);

  const updatePilot = useCallback((updatedPilot: Pilot) => {
    setPilots(prev => prev.map(p => p.id === updatedPilot.id ? updatedPilot : p));
  }, [setPilots]);

  const deletePilot = useCallback((pilotId: string) => {
    setPilots(prev => prev.filter(p => p.id !== pilotId));
  }, [setPilots]);
  
  const getPilotName = useCallback((pilotId: string): string => {
    const pilot = pilots.find(p => p.id === pilotId);
    return pilot ? `${pilot.firstName} ${pilot.lastName}` : 'Piloto Desconocido'; // Changed default
  }, [pilots]);

  return { pilots, addPilot, updatePilot, deletePilot, getPilotName, setPilots };
}

// Pilot Categories Store
export function usePilotCategoriesStore() {
  // Use the stable DEFAULT_PILOT_CATEGORIES for initialization
  const [categories, setCategories] = useLocalStorageState<PilotCategory[]>('pilotCategories', DEFAULT_PILOT_CATEGORIES);

  const addCategory = useCallback((categoryData: Omit<PilotCategory, 'id'>) => {
    // generateId() is fine here because this is a client-side user action
    const newCategory = { ...categoryData, id: generateId() };
    setCategories(prev => [...prev, newCategory]);
    return newCategory;
  }, [setCategories]);

  const updateCategory = useCallback((updatedCategory: PilotCategory) => {
    setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
  }, [setCategories]);

  const deleteCategory = useCallback((categoryId: string) => {
    setCategories(prev => prev.filter(c => c.id !== categoryId));
  }, [setCategories]);

  const getCategoryName = useCallback((categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Categoría Desconocida'; // Changed default
  }, [categories]);
  
  return { categories, addCategory, updateCategory, deleteCategory, getCategoryName, setCategories };
}

// Aircraft Store
export function useAircraftStore() {
  const [aircraft, setAircraft] = useLocalStorageState<Aircraft[]>('aircraft', []);

  const addAircraft = useCallback((aircraftData: Omit<Aircraft, 'id'>) => {
    const newAircraft = { ...aircraftData, id: generateId() };
    setAircraft(prev => [...prev, newAircraft]);
    return newAircraft;
  }, [setAircraft]);

  const updateAircraft = useCallback((updatedAircraft: Aircraft) => {
    setAircraft(prev => prev.map(a => a.id === updatedAircraft.id ? updatedAircraft : a));
  }, [setAircraft]);

  const deleteAircraft = useCallback((aircraftId: string) => {
    setAircraft(prev => prev.filter(a => a.id !== aircraftId));
  }, [setAircraft]);
  
  const getAircraftName = useCallback((aircraftId?: string): string => {
    if (!aircraftId) return 'N/A';
    const ac = aircraft.find(a => a.id === aircraftId);
    return ac ? ac.name : 'Aeronave Desconocida'; // Changed default
  }, [aircraft]);

  return { aircraft, addAircraft, updateAircraft, deleteAircraft, getAircraftName, setAircraft };
}

// Schedule Store
export function useScheduleStore() {
  const [scheduleEntries, setScheduleEntries] = useLocalStorageState<ScheduleEntry[]>('scheduleEntries', []);

  const addScheduleEntry = useCallback((entryData: Omit<ScheduleEntry, 'id'>) => {
    const newEntry = { ...entryData, id: generateId() };
    setScheduleEntries(prev => [...prev, newEntry]);
    return newEntry;
  }, [setScheduleEntries]);

  const updateScheduleEntry = useCallback((updatedEntry: ScheduleEntry) => {
    setScheduleEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
  }, [setScheduleEntries]);

  const deleteScheduleEntry = useCallback((entryId: string) => {
    setScheduleEntries(prev => prev.filter(e => e.id !== entryId));
  }, [setScheduleEntries]);

  return { scheduleEntries, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, setScheduleEntries };
}

// Daily Observations Store
export type DailyObservations = Record<string, string>; // Key: YYYY-MM-DD, Value: observation text

export function useDailyObservationsStore() {
  const [dailyObservations, setDailyObservations] = useLocalStorageState<DailyObservations>('dailyObservations', {});

  const getObservation = useCallback((date: string): string | undefined => {
    return dailyObservations[date];
  }, [dailyObservations]);

  const updateObservation = useCallback((date: string, text: string) => {
    setDailyObservations(prev => ({
      ...prev,
      [date]: text,
    }));
  }, [setDailyObservations]);

  return { dailyObservations, getObservation, updateObservation, setDailyObservations };
}
