
import { NextResponse } from 'next/server';
import { sendWeeklyActivityReport } from '@/ai/flows/telegram-report-flow';

export async function GET(request: Request) {
  // Simple check to prevent unauthorized access if the URL is public
  // For production, use a more secure method like a secret token in the URL
  // e.g., /api/cron?token=YOUR_SECRET_TOKEN
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  // NOTE: A more robust implementation would fetch this flag from a database
  // For now, we assume if the cron is called, it's meant to be enabled.
  // This logic should match the useLocalStorageState default in TelegramReportClient
  const isReportEnabled = true; 

  if (isReportEnabled) {
      const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
      if (!chatId) {
          console.error("Cron job failed: TELEGRAM_CHAT_ID is not set.");
          return new NextResponse('Telegram Chat ID not configured', { status: 500 });
      }
      try {
        console.log("Cron job started: Sending weekly activity report.");
        await sendWeeklyActivityReport(chatId);
        console.log("Cron job finished: Report sent successfully.");
        return NextResponse.json({ success: true, message: 'Weekly activity report sent.' });
      } catch (error: any) {
        console.error("Cron job failed:", error);
        return new NextResponse(`Error sending report: ${error.message}`, { status: 500 });
      }
  } else {
    console.log("Cron job skipped: Weekly report is disabled.");
    return NextResponse.json({ success: true, message: 'Weekly report is disabled, job skipped.' });
  }
}
