
import { NextResponse } from 'next/server';
import { sendTelegramReport } from '@/ai/flows/telegram-report-flow';

export async function GET() {
  // Simple check to prevent unauthorized access if the URL is public
  // For production, use a more secure method like a secret token in the URL
  // e.g., /api/cron?token=YOUR_SECRET_TOKEN
  // const token = request.nextUrl.searchParams.get('token');
  // if (token !== process.env.CRON_SECRET) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }
  
  // A local flag could be used to enable/disable the cron job from the UI
  // This example assumes it's always enabled if the cron is called.
  // You would fetch this setting from your database or config store.
  const isReportEnabled = true; 

  if (isReportEnabled) {
      try {
        console.log("Cron job started: Sending weekly Telegram report.");
        await sendTelegramReport();
        console.log("Cron job finished: Report sent successfully.");
        return NextResponse.json({ success: true, message: 'Weekly report sent.' });
      } catch (error: any) {
        console.error("Cron job failed:", error);
        return new NextResponse(`Error sending report: ${error.message}`, { status: 500 });
      }
  } else {
    console.log("Cron job skipped: Weekly report is disabled.");
    return NextResponse.json({ success: true, message: 'Weekly report is disabled, job skipped.' });
  }
}
