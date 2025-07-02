'use server';
/**
 * @fileOverview A Genkit flow to generate weekly flight summary emails for pilots.
 *
 * - generateWeeklySummary - A function that generates email content for all pilots with activity in the last week.
 * - WeeklySummary - The output type for the generateWeeklySummary function.
 */

import { ai } from '@/ai/genkit';
import { supabase } from '@/lib/supabaseClient';
import type { CompletedEngineFlight, CompletedGliderFlight, Pilot } from '@/types';
import { z } from 'genkit';
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const WeeklySummarySchema = z.object({
    pilotId: z.string(),
    pilotName: z.string(),
    subject: z.string(),
    htmlBody: z.string().describe("The full HTML content of the email body."),
});
export type WeeklySummary = z.infer<typeof WeeklySummarySchema>;

export async function generateWeeklySummary(): Promise<WeeklySummary[]> {
  return generateWeeklySummaryFlow();
}

const generateWeeklySummaryFlow = ai.defineFlow(
  {
    name: 'generateWeeklySummaryFlow',
    inputSchema: z.void(),
    outputSchema: z.array(WeeklySummarySchema),
  },
  async () => {
    // 1. Determine date range for the last full week (Monday to Sunday)
    const now = new Date();
    const lastWeek = subWeeks(now, 1);
    const startOfLastWeek = startOfWeek(lastWeek, { weekStartsOn: 1 }); // Monday
    const endOfLastWeek = endOfWeek(lastWeek, { weekStartsOn: 1 }); // Sunday

    const startDateStr = format(startOfLastWeek, 'yyyy-MM-dd');
    const endDateStr = format(endOfLastWeek, 'yyyy-MM-dd');

    // 2. Fetch all necessary data in parallel
    const [
        { data: engineFlights, error: engineError },
        { data: gliderFlights, error: gliderError },
        { data: pilots, error: pilotsError }
    ] = await Promise.all([
        supabase.from('completed_engine_flights').select('*').gte('date', startDateStr).lte('date', endDateStr),
        supabase.from('completed_glider_flights').select('*').gte('date', startDateStr).lte('date', endDateStr),
        supabase.from('pilots').select('id, first_name, last_name'),
    ]);

    if (engineError || gliderError || pilotsError) {
        console.error({ engineError, gliderError, pilotsError });
        throw new Error('Failed to fetch data from Supabase.');
    }
    
    if (!engineFlights || !gliderFlights || !pilots) {
        throw new Error('One or more data fetches returned null.');
    }

    // 3. Process and group flights by pilot
    const activityByPilot = new Map<string, {
        pilotName: string;
        picFlights: (CompletedEngineFlight | CompletedGliderFlight)[];
        instFlights: (CompletedEngineFlight | CompletedGliderFlight)[];
    }>();

    const getPilotName = (pilotId: string) => {
        const pilot = pilots.find(p => p.id === pilotId);
        return pilot ? `${pilot.first_name} ${pilot.last_name}` : 'Piloto Desconocido';
    };
    
    // Initialize map with all pilots to ensure we have their names
    pilots.forEach(p => {
        activityByPilot.set(p.id, {
            pilotName: getPilotName(p.id),
            picFlights: [],
            instFlights: []
        });
    });

    engineFlights.forEach(flight => {
        // Pilot in Command flights
        if (flight.pilot_id && activityByPilot.has(flight.pilot_id)) {
            activityByPilot.get(flight.pilot_id)!.picFlights.push(flight);
        }
        // Instructed flights
        if (flight.instructor_id && activityByPilot.has(flight.instructor_id)) {
            activityByPilot.get(flight.instructor_id)!.instFlights.push(flight);
        }
    });

    gliderFlights.forEach(flight => {
        // PIC flights
        if (flight.pilot_id && activityByPilot.has(flight.pilot_id)) {
             activityByPilot.get(flight.pilot_id)!.picFlights.push(flight);
        }
        // Instructed flights
        if (flight.instructor_id && activityByPilot.has(flight.instructor_id)) {
            activityByPilot.get(flight.instructor_id)!.instFlights.push(flight);
        }
    });

    // 4. Generate email content for each pilot with activity
    const emailSummaries: WeeklySummary[] = [];

    for (const [pilotId, data] of activityByPilot.entries()) {
        if (data.picFlights.length === 0 && data.instFlights.length === 0) {
            continue; // Skip pilots with no activity
        }

        const subject = `Resumen de Vuelos Semanal - ${format(startOfLastWeek, 'dd/MM/yy')} al ${format(endOfLastWeek, 'dd/MM/yy')}`;
        
        let htmlBody = `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2>Hola ${data.pilotName},</h2>
                <p>Este es tu resumen de actividad de vuelo para la semana del ${format(startOfLastWeek, "d 'de' MMMM", { locale: es })} al ${format(endOfLastWeek, "d 'de' MMMM 'de' yyyy", { locale: es })}.</p>
        `;

        if (data.picFlights.length > 0) {
            htmlBody += '<h3>Vuelos como Piloto al Mando:</h3><ul>';
            data.picFlights.forEach(f => {
                htmlBody += `<li>${format(parseISO(f.date), 'dd/MM/yy')}: Vuelo de ${f.flight_duration_decimal.toFixed(1)} hs. (${f.logbook_type === 'engine' ? 'Motor' : 'Planeador'})</li>`;
            });
            htmlBody += '</ul>';
        }

        if (data.instFlights.length > 0) {
            htmlBody += '<h3>Vuelos como Instructor:</h3><ul>';
            data.instFlights.forEach(f => {
                const studentName = getPilotName(f.pilot_id);
                htmlBody += `<li>${format(parseISO(f.date), 'dd/MM/yy')}: Instrucción a ${studentName} (${f.flight_duration_decimal.toFixed(1)} hs, ${f.logbook_type === 'engine' ? 'Motor' : 'Planeador'})</li>`;
            });
            htmlBody += '</ul>';
        }

        htmlBody += '<p>¡Buenos vuelos!</p><p>El equipo del Aeroclub 9 de Julio</p></div>';

        emailSummaries.push({
            pilotId: pilotId,
            pilotName: data.pilotName,
            subject: subject,
            htmlBody: htmlBody,
        });
    }

    return emailSummaries;
  }
);
