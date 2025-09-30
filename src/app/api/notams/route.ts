import { NextResponse } from 'next/server';

const ANAC_API_URL = "https://datos.anac.gob.ar/madhel/api/v2/airports/LIO/";

export async function GET() {
  try {
    const response = await fetch(ANAC_API_URL, {
      // ANAC API might be sensitive to user-agent, so let's mimic a browser.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      // Revalidate data every hour
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      // Log the error on the server and return a descriptive error to the client
      console.error(`ANAC API fetch failed: ${response.status} - ${response.statusText}`);
      const errorBody = await response.text();
      console.error('ANAC API response body:', errorBody);
      return NextResponse.json({ message: `Error al contactar la API de ANAC: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in NOTAMs API route:', error);
    return NextResponse.json({ message: `Error interno del servidor: ${error.message}` }, { status: 500 });
  }
}
