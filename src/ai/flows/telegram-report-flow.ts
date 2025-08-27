
'use server';
/**
 * @fileOverview Flow to generate and send a weekly activity report to Telegram.
 * 
 * - sendTelegramReport - The main function to trigger the report generation and sending.
 */
import 'dotenv/config'; // Ensure environment variables are loaded
import { supabase } from '@/lib/supabaseClient';
import { format, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Pilot, CompletedGliderFlight, CompletedEngineFlight, FlightPurpose } from '@/types';

type CombinedFlight = (CompletedGliderFlight | CompletedEngineFlight) & { flight_type: 'Planeador' | 'Motor' };

async function fetchPilots(): Promise<Pilot[]> {
    const { data, error } = await supabase.from('pilots').select('*');
    if (error) throw new Error(`Error fetching pilots: ${error.message}`);
    return data || [];
}

async function fetchFlightPurposes(): Promise<FlightPurpose[]> {
    const { data, error } = await supabase.from('flight_purposes').select('*');
    if (error) throw new Error(`Error fetching flight purposes: ${error.message}`);
    return data || [];
}


async function fetchFlightsFromLastWeek(): Promise<CombinedFlight[]> {
    const today = new Date();
    const lastWeek = subWeeks(today, 1);
    const startDate = format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'); // Monday
    const endDate = format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');   // Sunday

    const [gliderFlights, engineFlights] = await Promise.all([
        supabase
            .from('completed_glider_flights')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate),
        supabase
            .from('completed_engine_flights')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
    ]);

    if (gliderFlights.error) throw new Error(`Error fetching glider flights: ${gliderFlights.error.message}`);
    if (engineFlights.error) throw new Error(`Error fetching engine flights: ${engineFlights.error.message}`);

    const combined: CombinedFlight[] = [];
    (gliderFlights.data || []).forEach(f => combined.push({ ...f, flight_type: 'Planeador' }));
    (engineFlights.data || []).forEach(f => combined.push({ ...f, flight_type: 'Motor' }));
    
    combined.sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.departure_time.localeCompare(b.departure_time);
    });

    return combined;
}

function formatReport(flights: CombinedFlight[], pilots: Pilot[], purposes: FlightPurpose[]): string {
    if (flights.length === 0) {
        return "✈️ *Resumen de Actividad de la Semana Pasada*\n\nNo se registraron vuelos la semana anterior.";
    }

    const getPilotName = (id: string | null | undefined) => {
        if (!id) return 'N/A';
        const pilot = pilots.find(p => p.id === id);
        return pilot ? `${pilot.first_name} ${pilot.last_name}` : 'Desconocido';
    };
    const getPurposeName = (id: string) => purposes.find(p => p.id === id)?.name || 'N/A';

    const groupedByDate = flights.reduce((acc, flight) => {
        const date = flight.date;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(flight);
        return acc;
    }, {} as Record<string, CombinedFlight[]>);
    
    const today = new Date();
    const lastWeek = subWeeks(today, 1);
    const startOfLastWeek = startOfWeek(lastWeek, { weekStartsOn: 1 });
    const endOfLastWeek = endOfWeek(lastWeek, { weekStartsOn: 1 });
    
    const weekInterval = eachDayOfInterval({ start: startOfLastWeek, end: endOfLastWeek });
    
    let reportText = `✈️ *Resumen de Actividad de la Semana Pasada*\n_(${format(startOfLastWeek, "dd/MM")} al ${format(endOfLastWeek, "dd/MM")})_\n`;
    let totalGliderHours = 0;
    let totalEngineHours = 0;

    const processedFlightKeys = new Set<string>();

    weekInterval.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const flightsForDay = groupedByDate[dateStr];
        
        if (flightsForDay && flightsForDay.length > 0) {
            const formattedDate = format(parseISO(dateStr), 'EEEE dd/MM', { locale: es });
            reportText += `\n\n*${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}*`;

            flightsForDay.forEach(flight => {
                 const purposeName = getPurposeName(flight.flight_purpose_id);
                 const isInstruction = purposeName.includes('Instrucción');
                 
                 // Evitar duplicados de instrucción en el reporte y en los totales
                 const flightEventKey = `${flight.date}-${flight.departure_time}-${(flight as CompletedEngineFlight).engine_aircraft_id || (flight as CompletedGliderFlight).glider_aircraft_id}`;
                 if (isInstruction) {
                    if (processedFlightKeys.has(flightEventKey)) return;
                    processedFlightKeys.add(flightEventKey);
                 }

                // Acumular horas
                if (flight.flight_type === 'Planeador') {
                    totalGliderHours += flight.flight_duration_decimal;
                } else {
                    totalEngineHours += flight.flight_duration_decimal;
                }
                
                if (isInstruction) {
                    const student = getPilotName(flight.pilot_id);
                    const instructor = getPilotName(flight.instructor_id);
                    reportText += `\n- ${flight.departure_time.substring(0,5)}: Instrucción ${flight.flight_type} (${flight.flight_duration_decimal.toFixed(1)}hs) - Alumno: ${student}, Instructor: ${instructor}`;
                } else {
                    reportText += `\n- ${flight.departure_time.substring(0,5)}: ${purposeName} ${flight.flight_type} (${flight.flight_duration_decimal.toFixed(1)}hs) - Piloto: ${getPilotName(flight.pilot_id)}`;
                }
            });
        }
    });

    reportText += "\n\n\n*Totales de la Semana:*";
    reportText += `\n- Horas de Vuelo en Planeador: *${totalGliderHours.toFixed(1)} hs*`;
    reportText += `\n- Horas de Vuelo a Motor: *${totalEngineHours.toFixed(1)} hs*`;

    return reportText;
}

async function sendToTelegram(message: string) {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        throw new Error("Telegram Bot Token or Chat ID are not configured in environment variables.");
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
        }),
    });

    const result = await response.json();
    if (!result.ok) {
        let errorMessage = `Error de la API de Telegram: ${result.description}`;
        if (result.description?.includes('chat not found')) {
            errorMessage += "\n\nSugerencia: Revisa que el TELEGRAM_CHAT_ID sea correcto y que el bot haya sido añadido al chat/canal.";
        }
        throw new Error(errorMessage);
    }
}

export async function sendTelegramReport() {
    try {
        const [flights, pilots, purposes] = await Promise.all([
            fetchFlightsFromLastWeek(),
            fetchPilots(),
            fetchFlightPurposes(),
        ]);

        const report = formatReport(flights, pilots, purposes);
        await sendToTelegram(report);
        return { success: true, message: "Report sent successfully." };
    } catch (error: any) {
        console.error("Failed to send Telegram report:", error);
        throw error;
    }
}
