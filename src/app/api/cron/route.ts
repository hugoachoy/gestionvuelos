
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendWeeklyActivityReport } from '@/ai/flows/telegram-report-flow';

export async function GET(request: Request) {
  // Simple check to prevent unauthorized access if the URL is public
  // For production, use a more secure method like a secret token in the URL
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // NOTE: This logic should match the useLocalStorageState default in TelegramReportClient
  const isReportEnabled = true;

  if (isReportEnabled) {
    try {
      // 1. Fetch all pilots with a registered Telegram Chat ID
      const { data: pilots, error: pilotError } = await supabase
        .from('pilots')
        .select('id, telegram_chat_id, first_name')
        .not('telegram_chat_id', 'is', null);

      if (pilotError) {
        console.error("Cron job failed: Error fetching pilots.", pilotError);
        return new NextResponse('Error fetching pilots', { status: 500 });
      }

      if (!pilots || pilots.length === 0) {
        console.log("Cron job finished: No pilots with registered Telegram IDs to send reports to.");
        return NextResponse.json({ success: true, message: 'No pilots with Telegram IDs found.' });
      }

      // 2. Iterate and send a personalized report to each pilot
      let successCount = 0;
      let errorCount = 0;
      
      console.log(`Cron job started: Found ${pilots.length} pilots to notify.`);

      for (const pilot of pilots) {
        try {
          // The sendWeeklyActivityReport function now handles fetching flights for the specific pilot.
          await sendWeeklyActivityReport(pilot.telegram_chat_id, pilot.id);
          console.log(`Successfully sent report to pilot ${pilot.first_name} (ID: ${pilot.id})`);
          successCount++;
        } catch (error: any) {
          console.error(`Cron job failed for pilot ${pilot.id}:`, error.message);
          errorCount++;
        }
      }

      const summaryMessage = `Cron job finished. Reports sent: ${successCount}. Errors: ${errorCount}.`;
      console.log(summaryMessage);
      return NextResponse.json({ success: true, message: summaryMessage });

    } catch (error: any) {
      console.error("Cron job failed with a critical error:", error);
      return new NextResponse(`Critical error during cron execution: ${error.message}`, { status: 500 });
    }
  } else {
    console.log("Cron job skipped: Weekly report is disabled.");
    return NextResponse.json({ success: true, message: 'Weekly report is disabled, job skipped.' });
  }
}
