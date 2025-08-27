
'use server';

import { sendMainMenu, sendWeeklyActivityReport, sendNextWeekScheduleReport } from './telegram-report-flow';

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
    // You can add more text command handlers here if needed
  }
  // Check for a callback query (button press)
  else if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const data = update.callback_query.data;

    // Acknowledge the button press to remove the loading indicator on the user's side.
    // This part requires node-telegram-bot-api or a direct API call if not using it.
    // For now, we'll proceed with handling the command.

    switch (data) {
      case 'weekly_activity':
        await sendWeeklyActivityReport(chatId);
        break;
      case 'next_week_schedule':
        await sendNextWeekScheduleReport(chatId);
        break;
      case 'monthly_billing':
        // Placeholder for future functionality
        // await sendToTelegram(chatId, "La función de facturación mensual estará disponible próximamente.");
        break;
      default:
        // Optionally handle unknown commands
        break;
    }
  }
}
