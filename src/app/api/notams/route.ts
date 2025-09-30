import { NextResponse } from 'next/server';

const MADHEL_API_URL = "https://datos.anac.gob.ar/madhel/api/v2/airports/LIO/";
const NOTAM_API_URL = "https://ais.anac.gob.ar/notam/json";

export async function GET() {
  try {
    // --- Step 1: Fetch main airport data from MADHEL ---
    const madhelResponse = await fetch(MADHEL_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      next: { revalidate: 3600 } 
    });

    if (!madhelResponse.ok) {
      const errorBody = await madhelResponse.text();
      console.error(`MADHEL API fetch failed: ${madhelResponse.status} - ${madhelResponse.statusText}`, errorBody);
      if (madhelResponse.status === 403) {
         return NextResponse.json(
           { message: `El servicio de MADHEL no está disponible actualmente.` }, 
           { status: 503, statusText: 'Service Unavailable' }
         );
      }
      return NextResponse.json(
        { message: `Error al contactar la API de MADHEL: ${madhelResponse.statusText}` }, 
        { status: madhelResponse.status }
      );
    }

    const airportData = await madhelResponse.json();

    // --- Step 2: Fetch NOTAM data from the specific NOTAM API ---
    try {
      const notamResponse = await fetch(NOTAM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        body: 'indicador=LIO',
        next: { revalidate: 3600 } // Revalidate every hour
      });

      if (notamResponse.ok) {
        const notamData = await notamResponse.json();
        // --- Step 3: Combine the data ---
        // The `notamData` itself is the array of NOTAMs
        if (notamData && Array.isArray(notamData)) {
            airportData.notam = notamData; 
        }
      } else {
        console.warn(`Failed to fetch NOTAM data, continuing without it. Status: ${notamResponse.status}`);
        // If this call fails, we still return the airport data, just with empty notams.
      }
    } catch(notamError) {
        console.warn('An unexpected error occurred while fetching NOTAM data. Continuing without it.', notamError);
    }

    return NextResponse.json(airportData);

  } catch (error: any) {
    console.error('Error in NOTAMs API route:', error);
    return NextResponse.json({ message: `Error interno del servidor: ${error.message}` }, { status: 500 });
  }
}
