
'use server';

import { sendMainMenu, sendWeeklyActivityReport, sendNextWeekScheduleReport } from './telegram-report-flow';
import { supabase } from '@/lib/supabaseClient';
import TelegramBot from 'node-telegram-bot-api';

// Helper to send a message back - integrated for simplicity and directness
async function sendTelegramMessage(chatId: string | number, text: string) {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error("TELEGRAM_BOT_TOKEN not configured. Cannot send message.");
        return; // Early exit if no token
    }
    const bot = new TelegramBot(botToken); // Initialize on-demand
    try {
        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error: any) {
        console.error(`Failed to send message to chatId ${chatId}:`, error.message);
    }
}


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
      return;
    } 
    
    if (text === '/testpilot') {
      try {
        const { data: pilot, error } = await supabase
          .from('pilots')
          .select('id, first_name, last_name')
          .eq('telegram_chat_id', chatId.toString())
          .single();

        if (error || !pilot) {
          await sendTelegramMessage(chatId, `Fallo: No se pudo encontrar un perfil de piloto asociado a este ID de chat (${chatId}). Error: ${error?.message || 'Piloto no encontrado.'}`);
        } else {
          await sendTelegramMessage(chatId, `Éxito: Se encontró un perfil de piloto para este chat. Piloto: *${pilot.first_name} ${pilot.last_name}* (ID: ${pilot.id}).`);
        }
      } catch (e: any) {
        await sendTelegramMessage(chatId, `Error catastrófico en la prueba: ${e.message}`);
      }
      return;
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
      await sendTelegramMessage(chatId, "No pude encontrar un perfil de piloto asociado a este chat de Telegram. Por favor, asegúrate de que tu `telegram_chat_id` esté configurado correctamente en tu perfil.");
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
        await sendTelegramMessage(chatId, "La función de facturación mensual estará disponible próximamente.");
        break;
      default:
        // Optionally handle unknown commands
        break;
    }
  }
}
