
'use server';
/**
 * @fileOverview Flow to generate and send various reports to Telegram.
 * 
 * - sendTelegramReport - The main function to trigger the report generation and sending.
 */
import 'dotenv/config'; // Ensure environment variables are loaded
import { supabase } from '@/lib/supabaseClient';
import { format, subDays, startOfWeek, endOfWeek, parseISO, addDays, nextMonday, subWeeks, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Pilot, CompletedGliderFlight, CompletedEngineFlight, FlightPurpose, ScheduleEntry, PilotCategory, Aircraft } from '@/types';
import TelegramBot from 'node-telegram-bot-api';
import { FLIGHT_TYPES } from '@/types';


// Initialize bot
const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
if (!botToken) {
    console.error("Telegram Bot Token is not configured. Report generation will fail.");
}
const bot = new TelegramBot(botToken || 'dummy-token');


// --- Data Fetching ---
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

async function fetchAircraft(): Promise<Aircraft[]> {
    const { data, error } = await supabase.from('aircraft').select('*');
    if (error) throw new Error(`Error fetching aircraft: ${error.message}`);
    return data || [];
}

async function fetchPilotCategories(): Promise<PilotCategory[]> {
    const { data, error } = await supabase.from('pilot_categories').select('*');
    if (error) throw new Error(`Error fetching pilot categories: ${error.message}`);
    return data || [];
}


async function fetchFlightsFromLastWeek(): Promise<(CompletedGliderFlight | CompletedEngineFlight)[]> {
    const today = new Date();
    // Fetch flights from the last year to ensure test data is included.
    const startDate = format(subYears(today, 1), 'yyyy-MM-dd');
    const endDate = format(today, 'yyyy-MM-dd');

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

    const combined = [...(gliderFlights.data || []), ...(engineFlights.data || [])];
    
    combined.sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.departure_time.localeCompare(b.departure_time);
    });

    return combined;
}

async function fetchScheduleForNextWeek(): Promise<ScheduleEntry[]> {
    const today = new Date();
    const monday = nextMonday(today);
    const sunday = addDays(monday, 6);
    
    const startDate = format(monday, 'yyyy-MM-dd');
    const endDate = format(sunday, 'yyyy-MM-dd');

    const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date')
        .order('start_time');

    if (error) throw new Error(`Error fetching schedule: ${error.message}`);
    return data || [];
}


// --- Report Formatting ---
function formatActivityReport(flights: (CompletedGliderFlight | CompletedEngineFlight)[], pilots: Pilot[], purposes: FlightPurpose[], aircraft: Aircraft[]): string {
    if (flights.length === 0) {
        return "✈️ *Resumen de Actividad de los Últimos 7 Días*\n\nNo se registraron vuelos en este período.";
    }

    const getPilotName = (id: string | null | undefined) => {
        if (!id) return 'N/A';
        const pilot = pilots.find(p => p.id === id);
        return pilot ? `${pilot.first_name.charAt(0)}. ${pilot.last_name}` : 'Desconocido';
    };
    const getPurposeName = (id: string) => purposes.find(p => p.id === id)?.name || 'N/A';
    const getAircraftName = (id: string | null | undefined) => {
        if (!id) return 'N/A';
        return aircraft.find(a => a.id === id)?.name || 'N/A';
    };


    const groupedByDate = flights.reduce((acc, flight) => {
        const date = flight.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(flight);
        return acc;
    }, {} as Record<string, (CompletedGliderFlight | CompletedEngineFlight)[]>);
    
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);
    
    let reportText = `✈️ *Resumen de Actividad de los Últimos 7 Días*\n_(${format(sevenDaysAgo, "dd/MM/yyyy")} al ${format(today, "dd/MM/yyyy")})_\n`;
    
    let totalGliderHours = 0;
    let totalEngineHours = 0;
    
    const processedFlights = new Set<string>();

    Object.keys(groupedByDate).sort().forEach(dateStr => {
        reportText += `\n\n*${format(parseISO(dateStr), 'EEEE dd/MM', { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}*`;
        const flightsForDay = groupedByDate[dateStr];

        flightsForDay.forEach(flight => {
             const flightKey = `${flight.date}-${flight.departure_time}-${(flight as any).glider_aircraft_id || (flight as any).engine_aircraft_id}`;
             if(processedFlights.has(flightKey)) return;

            const purposeName = getPurposeName(flight.flight_purpose_id);
            
            if (purposeName.includes('Instrucción')) {
                const counterpart = flightsForDay.find(f => 
                    f.id !== flight.id &&
                    f.date === flight.date &&
                    f.departure_time === flight.departure_time &&
                    f.arrival_time === flight.arrival_time &&
                    ((f as any).glider_aircraft_id === (flight as any).glider_aircraft_id || (f as any).engine_aircraft_id === (flight as any).engine_aircraft_id)
                );
                
                if (counterpart) {
                    const studentFlight = flight.instructor_id ? flight : counterpart;
                    const instructorRecord = flight.instructor_id ? counterpart : flight;
                    const aircraftName = getAircraftName((studentFlight as CompletedGliderFlight).glider_aircraft_id || (studentFlight as CompletedEngineFlight).engine_aircraft_id);
                    reportText += `\n- ${flight.departure_time.substring(0,5)}: Instrucción en ${aircraftName} (${flight.flight_duration_decimal.toFixed(1)}hs) - Alumno: ${getPilotName(studentFlight.pilot_id)}, Instructor: ${getPilotName(studentFlight.instructor_id)}`;
                    processedFlights.add(flightKey);
                } else {
                    // Orphaned instruction flight, log as is
                    const aircraftName = getAircraftName((flight as CompletedGliderFlight).glider_aircraft_id || (flight as CompletedEngineFlight).engine_aircraft_id);
                    reportText += `\n- ${flight.departure_time.substring(0,5)}: ${purposeName} en ${aircraftName} (${flight.flight_duration_decimal.toFixed(1)}hs) - Piloto: ${getPilotName(flight.pilot_id)}`;
                }

            } else {
                 const aircraftName = getAircraftName((flight as CompletedGliderFlight).glider_aircraft_id || (flight as CompletedEngineFlight).engine_aircraft_id);
                 reportText += `\n- ${flight.departure_time.substring(0,5)}: ${purposeName} en ${aircraftName} (${flight.flight_duration_decimal.toFixed(1)}hs) - Piloto: ${getPilotName(flight.pilot_id)}`;
            }

            if (flight.logbook_type === 'glider') {
                totalGliderHours += flight.flight_duration_decimal;
            } else {
                totalEngineHours += flight.flight_duration_decimal;
            }
        });
    });

    reportText += `\n\n\n*Totales de la Semana:*`;
    reportText += `\n- Horas de Vuelo en Planeador: *${(totalGliderHours / 2).toFixed(1)} hs*`;
    reportText += `\n- Horas de Vuelo a Motor: *${(totalEngineHours / 2).toFixed(1)} hs*`;
    return reportText;
}


function formatScheduleReport(schedule: ScheduleEntry[], allPilots: Pilot[], allCategories: PilotCategory[], allAircraft: Aircraft[]): string {
    if (schedule.length === 0) {
        return "🗓️ *Agenda de la Próxima Semana*\n\nNo hay turnos programados para la próxima semana.";
    }

    const getPilotName = (id: string | null | undefined) => {
        if (!id) return 'N/A';
        const pilot = allPilots.find(p => p.id === id);
        return pilot ? `${pilot.first_name.charAt(0)}. ${pilot.last_name}` : 'Desconocido';
    };
    const getAircraftName = (id: string | null | undefined) => {
        if (!id) return 'N/A';
        return allAircraft.find(a => a.id === id)?.name || 'N/A';
    };
    const getCategoryName = (id: string | null | undefined) => {
        if (!id) return 'N/A';
        return allCategories.find(c => c.id === id)?.name || 'N/A';
    };
     const getFlightTypeName = (id: string) => FLIGHT_TYPES.find(ft => ft.id === id)?.name || 'N/A';

    const groupedByDate = schedule.reduce((acc, entry) => {
        const date = entry.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(entry);
        return acc;
    }, {} as Record<string, ScheduleEntry[]>);

    let reportText = `🗓️ *Agenda de la Próxima Semana*\n`;

    Object.keys(groupedByDate).sort().forEach(dateStr => {
        const entriesForDay = groupedByDate[dateStr];
        const formattedDate = format(parseISO(dateStr), 'EEEE dd/MM', { locale: es });
        reportText += `\n\n*${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}*`;

        entriesForDay.forEach(entry => {
            reportText += `\n- ${entry.start_time.substring(0, 5)}: ${getPilotName(entry.pilot_id)} (${getCategoryName(entry.pilot_category_id)}) - Vuelo: *${getFlightTypeName(entry.flight_type_id)}* - Aeronave: ${getAircraftName(entry.aircraft_id)}`;
        });
    });

    return reportText;
}


// --- Main Sending Logic ---

async function sendToTelegram(chatId: string | number, message: string, options?: any) {
    if (!botToken) {
        throw new Error("Telegram Bot Token is not configured in environment variables.");
    }
    
    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
    } catch(error: any) {
        let errorMessage = `Error de la API de Telegram: ${error.message}`;
        if (error.response?.body?.description?.includes('chat not found')) {
            errorMessage += "\n\nSugerencia: Revisa que el TELEGRAM_CHAT_ID sea correcto y que el bot haya sido añadido al chat/canal.";
        }
        throw new Error(errorMessage);
    }
}

export async function sendMainMenu(chatId: string | number) {
    const text = "Hola! Soy el bot del Aeroclub. ¿Qué te gustaría hacer?";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Actividad Semana Pasada', callback_data: 'weekly_activity' },
                    { text: 'Agenda Próxima Semana', callback_data: 'next_week_schedule' }
                ],
                [
                    { text: 'Facturación del Mes (Próximamente)', callback_data: 'monthly_billing' }
                ]
            ]
        }
    };
    await sendToTelegram(chatId, text, options);
}

export async function sendWeeklyActivityReport(chatId: string | number) {
    try {
        const [flights, pilots, purposes, aircraft] = await Promise.all([
            fetchFlightsFromLastWeek(),
            fetchPilots(),
            fetchFlightPurposes(),
            fetchAircraft(),
        ]);
        const report = formatActivityReport(flights, pilots, purposes, aircraft);
        await sendToTelegram(chatId, report);
    } catch (error: any) {
        console.error("Failed to send weekly activity report:", error);
        await sendToTelegram(chatId, `Error al generar el informe de actividad: ${error.message}`);
    }
}

export async function sendNextWeekScheduleReport(chatId: string | number) {
    try {
        const [schedule, pilots, categories, aircraft] = await Promise.all([
            fetchScheduleForNextWeek(),
            fetchPilots(),
            fetchPilotCategories(),
            fetchAircraft(),
        ]);
        const report = formatScheduleReport(schedule, pilots, categories, aircraft);
        await sendToTelegram(chatId, report);
    } catch (error: any) {
        console.error("Failed to send next week schedule report:", error);
        await sendToTelegram(chatId, `Error al generar el informe de la agenda: ${error.message}`);
    }
}
