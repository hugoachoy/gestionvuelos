"use client";

import type { Pilot, PilotCategory, Aircraft, ScheduleEntry } from '@/types';
import useLocalStorageState from '@/hooks/use-local-storage-state';

const generateId = () => crypto.randomUUID();

// Pilots Store
export function usePilotsStore() {
  const [pilots, setPilots] = useLocalStorageState<Pilot[]>('pilots', []);

  const addPilot = (pilotData: Omit<Pilot, 'id' | 'categoryIds'> & { categoryIds?: string[] }) => {
    const newPilot: Pilot = { ...pilotData, categoryIds: pilotData.categoryIds || [], id: generateId() };
    setPilots(prev => [...prev, newPilot]);
    return newPilot;
  };

  const updatePilot = (updatedPilot: Pilot) => {
    setPilots(prev => prev.map(p => p.id === updatedPilot.id ? updatedPilot : p));
  };

  const deletePilot = (pilotId: string) => {
    setPilots(prev => prev.filter(p => p.id !== pilotId));
  };
  
  const getPilotName = (pilotId: string): string => {
    const pilot = pilots.find(p => p.id === pilotId);
    return pilot ? `${pilot.firstName} ${pilot.lastName}` : 'Unknown Pilot';
  };

  return { pilots, addPilot, updatePilot, deletePilot, getPilotName, setPilots };
}

// Pilot Categories Store
export function usePilotCategoriesStore() {
  const [categories, setCategories] = useLocalStorageState<PilotCategory[]>('pilotCategories', [
    // Initial default categories as per proposal
    { id: generateId(), name: 'Piloto remolcador' },
    { id: generateId(), name: 'Instructor' },
    { id: generateId(), name: 'Piloto planeador' },
  ]);

  const addCategory = (categoryData: Omit<PilotCategory, 'id'>) => {
    const newCategory = { ...categoryData, id: generateId() };
    setCategories(prev => [...prev, newCategory]);
    return newCategory;
  };

  const updateCategory = (updatedCategory: PilotCategory) => {
    setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
  };

  const deleteCategory = (categoryId: string) => {
    setCategories(prev => prev.filter(c => c.id !== categoryId));
  };

  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };
  
  return { categories, addCategory, updateCategory, deleteCategory, getCategoryName, setCategories };
}

// Aircraft Store
export function useAircraftStore() {
  const [aircraft, setAircraft] = useLocalStorageState<Aircraft[]>('aircraft', []);

  const addAircraft = (aircraftData: Omit<Aircraft, 'id'>) => {
    const newAircraft = { ...aircraftData, id: generateId() };
    setAircraft(prev => [...prev, newAircraft]);
    return newAircraft;
  };

  const updateAircraft = (updatedAircraft: Aircraft) => {
    setAircraft(prev => prev.map(a => a.id === updatedAircraft.id ? updatedAircraft : a));
  };

  const deleteAircraft = (aircraftId: string) => {
    setAircraft(prev => prev.filter(a => a.id !== aircraftId));
  };
  
  const getAircraftName = (aircraftId?: string): string => {
    if (!aircraftId) return 'N/A';
    const ac = aircraft.find(a => a.id === aircraftId);
    return ac ? ac.name : 'Unknown Aircraft';
  };

  return { aircraft, addAircraft, updateAircraft, deleteAircraft, getAircraftName, setAircraft };
}

// Schedule Store
export function useScheduleStore() {
  const [scheduleEntries, setScheduleEntries] = useLocalStorageState<ScheduleEntry[]>('scheduleEntries', []);

  const addScheduleEntry = (entryData: Omit<ScheduleEntry, 'id'>) => {
    const newEntry = { ...entryData, id: generateId() };
    setScheduleEntries(prev => [...prev, newEntry]);
    return newEntry;
  };

  const updateScheduleEntry = (updatedEntry: ScheduleEntry) => {
    setScheduleEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
  };

  const deleteScheduleEntry = (entryId: string) => {
    setScheduleEntries(prev => prev.filter(e => e.id !== entryId));
  };

  return { scheduleEntries, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, setScheduleEntries };
}
