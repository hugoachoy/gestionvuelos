
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Simple check to prevent unauthorized access if the URL is public
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Telegram logic has been removed. 
  // This cron job now only logs a message.
  const summaryMessage = "Cron job executed successfully (Telegram reporting logic removed).";
  console.log(summaryMessage);
  return NextResponse.json({ success: true, message: summaryMessage });
}
