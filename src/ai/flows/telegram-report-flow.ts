
'use server';
/**
 * @fileOverview Flow to generate and send a weekly schedule report to Telegram.
 * 
 * - sendTelegramReport - The main function to trigger the report generation and sending.
 */

import { supabase } from '@/lib/supabaseClient';
import { format, addDays, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ScheduleEntry, Pilot, PilotCategory } from '@/types';

async function fetchPilots(): Promise<Pilot[]> {
    const { data, error } = await supabase.from('pilots').select('*');
    if (error) throw new Error(`Error fetching pilots: ${error.message}`);
    return data || [];
}

async function fetchCategories(): Promise<PilotCategory[]> {
    const { data, error } = await supabase.from('pilot_categories').select('*');
    if (error) throw new Error(`Error fetching categories: ${error.message}`);
    return data || [];
}

async function fetchScheduleForNextWeek(): Promise<ScheduleEntry[]> {
    const today = new Date();
    const oneWeekFromNow = addDays(today, 6);
    const startDate = format(today, 'yyyy-MM-dd');
    const endDate = format(oneWeekFromNow, 'yyyy-MM-dd');

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

function formatReport(schedule: ScheduleEntry[], pilots: Pilot[], categories: PilotCategory[]): string {
    if (schedule.length === 0) {
        return "✈️ *Agenda de la Próxima Semana*\n\nNo hay turnos programados para los próximos 7 días.";
    }

    const getPilotName = (id: string) => pilots.find(p => p.id === id)?.first_name || 'Desconocido';
    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';

    const groupedByDate = schedule.reduce((acc, entry) => {
        const date = entry.date;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(entry);
        return acc;
    }, {} as Record<string, ScheduleEntry[]>);

    let reportText = "✈️ *Agenda de la Próxima Semana*\n";

    const today = new Date();
    const oneWeekFromNow = addDays(today, 6);
    const dateInterval = eachDayOfInterval({ start: today, end: oneWeekFromNow });
    
    dateInterval.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const entriesForDay = groupedByDate[dateStr];
        
        const formattedDate = format(day, 'EEEE dd/MM', { locale: es });
        reportText += `\n\n*${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}*`;

        if (entriesForDay && entriesForDay.length > 0) {
            entriesForDay.forEach(entry => {
                const pilotName = getPilotName(entry.pilot_id);
                const categoryName = getCategoryName(entry.pilot_category_id);
                reportText += `\n- ${entry.start_time.substring(0,5)}: ${pilotName} (${categoryName})`;
            });
        } else {
            reportText += "\n_Sin turnos programados_";
        }
    });

    return reportText;
}

async function sendToTelegram(message: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

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
        throw new Error(`Telegram API error: ${result.description}`);
    }
}

export async function sendTelegramReport() {
    try {
        const [schedule, pilots, categories] = await Promise.all([
            fetchScheduleForNextWeek(),
            fetchPilots(),
            fetchCategories(),
        ]);

        const report = formatReport(schedule, pilots, categories);
        await sendToTelegram(report);
        return { success: true, message: "Report sent successfully." };
    } catch (error: any) {
        console.error("Failed to send Telegram report:", error);
        // Do not throw in a serverless function context to avoid unhandled promise rejections,
        // but return an error state. In a direct call, throwing is fine.
        // For this use case, we'll throw to let the caller handle it.
        throw error;
    }
}
