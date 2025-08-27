
import { NextRequest, NextResponse } from 'next/server';
import { processTelegramUpdate } from '@/ai/flows/telegram-webhook-flow';
import 'dotenv/config';

// This is your new webhook endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Asynchronously process the update without blocking the response
    processTelegramUpdate(body).catch(error => {
      console.error("Error processing Telegram update:", error);
      // Here you might want to add more robust error handling,
      // like sending a notification to an admin channel.
    });

    // Immediately respond to Telegram to acknowledge receipt of the update
    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error("Error parsing request body or initial processing:", error);
    return new NextResponse('Error processing request', { status: 500 });
  }
}

export async function GET() {
    return NextResponse.json({ message: "Telegram webhook is active. Use POST for updates." });
}
