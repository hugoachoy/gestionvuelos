
'use server';

import { sendMainMenu, sendWeeklyActivityReport, sendNextWeekScheduleReport } from './telegram-report-flow';
import { supabase } from '@/lib/supabaseClient';

/**
 * Processes incoming updates from the Telegram webhook.
 * @param update The update object from Telegram.
 */
export async function processTelegramUpdate(update: any) {
  // Check for a message with text
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;

    if (text === '/start' || text === '/menu') {
      await sendMainMenu(chatId);
    }
  }
  // Check for a callback query (button press)
  else if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const data = update.callback_query.data;

    // Find the pilot associated with this telegram chat ID
    const { data: pilot, error } = await supabase
      .from('pilots')
      .select('id')
      .eq('telegram_chat_id', chatId.toString())
      .single();

    if (error || !pilot) {
      await sendToTelegram(chatId, "No pude encontrar un perfil de piloto asociado a este chat de Telegram. Por favor, asegúrate de que tu `telegram_chat_id` esté configurado correctamente en tu perfil.");
      return;
    }

    switch (data) {
      case 'weekly_activity':
        await sendWeeklyActivityReport(chatId, pilot.id);
        break;
      case 'next_week_schedule':
        await sendNextWeekScheduleReport(chatId);
        break;
      case 'monthly_billing':
        await sendToTelegram(chatId, "La función de facturación mensual estará disponible próximamente.");
        break;
      default:
        // Optionally handle unknown commands
        break;
    }
  }
}

// Helper to send a message back - useful for error messages.
async function sendToTelegram(chatId: string | number, text: string) {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error("Telegram bot token not configured.");
        return;
    }
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
            }),
        });
    } catch (error) {
        console.error("Error sending message to Telegram:", error);
    }
}
