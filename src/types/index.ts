export interface Pilot {
  id: string;
  firstName: string;
  lastName: string;
  categoryIds: string[]; // IDs of PilotCategory
  medicalExpiry: string; // Store as ISO string YYYY-MM-DD
}

export interface PilotCategory {
  id: string;
  name: string;
}

export interface Aircraft {
  id: string;
  name: string; // Registration or common name
  type: 'Tow Plane' | 'Glider';
}

export const FLIGHT_TYPES = [
  { id: 'instruction', name: 'Instrucción' },
  { id: 'local', name: 'Local' },
  { id: 'sport', name: 'Deportivo' },
] as const;

export type FlightType = typeof FLIGHT_TYPES[number];
export type FlightTypeName = FlightType['name'];
export type FlightTypeId = FlightType['id'];

export interface ScheduleEntry {
  id: string;
  date: string; // Store as ISO string YYYY-MM-DD
  startTime: string; // e.g., "09:00"
  pilotId: string;
  pilotCategoryId: string; // Category chosen for this specific flight/slot
  isTowPilotAvailable?: boolean; // Relevant if pilotCategoryId corresponds to "Piloto remolcador"
  flightTypeId: FlightTypeId;
  aircraftId?: string; // Optional: which specific aircraft
}
