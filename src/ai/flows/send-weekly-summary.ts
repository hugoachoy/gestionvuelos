
'use server';
/**
 * @fileOverview A Genkit flow to generate and send weekly flight summary emails to pilots.
 *
 * - sendWeeklySummary - A function that handles the generation and sending process.
 */
import 'dotenv/config'; // Explicitly load environment variables

import { ai } from '@/ai/genkit';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient'; // Import both clients
import { z } from 'zod';
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import { WeeklySummaryStatusSchema, type CompletedEngineFlight, type CompletedGliderFlight, type WeeklySummaryStatus } from '@/types';


export async function sendWeeklySummary(): Promise<WeeklySummaryStatus> {
  return sendWeeklySummaryFlow();
}

const sendWeeklySummaryFlow = ai.defineFlow(
  {
    name: 'sendWeeklySummaryFlow',
    inputSchema: z.void(),
    outputSchema: WeeklySummaryStatusSchema,
  },
  async () => {
    // 1. Setup MailerSend
    if (!process.env.MAILERSEND_API_KEY || !process.env.MAIL_FROM_ADDRESS) {
      throw new Error("MailerSend API Key or From Address is not configured in environment variables (MAILERSEND_API_KEY, MAIL_FROM_ADDRESS).");
    }
    const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });
    const fromSender = new Sender(process.env.MAIL_FROM_ADDRESS, "Aeroclub 9 de Julio");

    // 2. Determine date range for the last full week
    const now = new Date();
    const lastWeek = subWeeks(now, 1);
    const startOfLastWeek = startOfWeek(lastWeek, { weekStartsOn: 1 });
    const endOfLastWeek = endOfWeek(lastWeek, { weekStartsOn: 1 });
    const startDateStr = format(startOfLastWeek, 'yyyy-MM-dd');
    const endDateStr = format(endOfLastWeek, 'yyyy-MM-dd');

    // 3. Fetch all necessary data using the standard (RLS-enabled) client
    const [
        { data: engineFlights, error: engineError },
        { data: gliderFlights, error: gliderError },
        { data: pilots, error: pilotsError }
    ] = await Promise.all([
        supabase.from('completed_engine_flights').select('*').gte('date', startDateStr).lte('date', endDateStr),
        supabase.from('completed_glider_flights').select('*').gte('date', startDateStr).lte('date', endDateStr),
        supabase.from('pilots').select('id, first_name, last_name, auth_user_id'),
    ]);

    if (engineError || gliderError || pilotsError) {
        console.error({ engineError, gliderError, pilotsError });
        throw new Error('Failed to fetch data from Supabase.');
    }
    
    if (!engineFlights || !gliderFlights || !pilots) {
        throw new Error('One or more data fetches returned null.');
    }

    // 4. Process and group flights by pilot
    const activityByPilot = new Map<string, {
        pilotName: string;
        authUserId?: string | null;
        picFlights: (CompletedEngineFlight | CompletedGliderFlight)[];
        instFlights: (CompletedEngineFlight | CompletedGliderFlight)[];
    }>();

    const getPilotName = (pilotId: string) => {
        const pilot = pilots.find(p => p.id === pilotId);
        return pilot ? `${pilot.first_name} ${pilot.last_name}` : 'Piloto Desconocido';
    };
    
    pilots.forEach(p => {
        activityByPilot.set(p.id, {
            pilotName: getPilotName(p.id),
            authUserId: p.auth_user_id,
            picFlights: [],
            instFlights: []
        });
    });

    engineFlights.forEach(flight => {
        if (flight.pilot_id && activityByPilot.has(flight.pilot_id)) {
            activityByPilot.get(flight.pilot_id)!.picFlights.push(flight);
        }
        if (flight.instructor_id && activityByPilot.has(flight.instructor_id)) {
            activityByPilot.get(flight.instructor_id)!.instFlights.push(flight);
        }
    });

    gliderFlights.forEach(flight => {
        if (flight.pilot_id && activityByPilot.has(flight.pilot_id)) {
             activityByPilot.get(flight.pilot_id)!.picFlights.push(flight);
        }
        if (flight.instructor_id && activityByPilot.has(flight.instructor_id)) {
            activityByPilot.get(flight.instructor_id)!.instFlights.push(flight);
        }
    });

    // 5. Generate and send emails
    const emailPromises = [];
    const statusDetails: WeeklySummaryStatus['details'] = [];
    const pilotsWithActivity = Array.from(activityByPilot.entries()).filter(([_, data]) => data.picFlights.length > 0 || data.instFlights.length > 0);

    for (const [pilotId, data] of pilotsWithActivity) {
        if (!data.authUserId) {
            statusDetails.push({ pilotId, pilotName: data.pilotName, status: "no_email", error: "Pilot profile not linked to an auth user." });
            continue;
        }
        
        // Use the ADMIN client to get user email, bypassing RLS
        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(data.authUserId);

        if (authUserError || !authUser.user.email) {
            statusDetails.push({ pilotId, pilotName: data.pilotName, status: "no_email", error: authUserError?.message || "Email not found for auth user." });
            continue;
        }

        const pilotEmail = authUser.user.email;
        const subject = `Resumen de Vuelos Semanal - ${format(startOfLastWeek, 'dd/MM/yy')} al ${format(endOfLastWeek, 'dd/MM/yy')}`;
        
        let htmlBody = `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2>Hola ${data.pilotName},</h2>
                <p>Este es tu resumen de actividad de vuelo para la semana del ${format(startOfLastWeek, "d 'de' MMMM", { locale: es })} al ${format(endOfLastWeek, "d 'de' MMMM 'de' yyyy", { locale: es })}.</p>
        `;

        if (data.picFlights.length > 0) {
            htmlBody += '<h3>Vuelos como Piloto al Mando:</h3><ul>';
            data.picFlights.forEach(f => {
                htmlBody += `<li>${format(parseISO(f.date), 'dd/MM/yy')}: Vuelo de ${f.flight_duration_decimal.toFixed(1)} hs. (${f.logbook_type === 'engine' ? 'Motor' : 'Planeador'})</li>`;
            });
            htmlBody += '</ul>';
        }

        if (data.instFlights.length > 0) {
            htmlBody += '<h3>Vuelos como Instructor:</h3><ul>';
            data.instFlights.forEach(f => {
                const studentName = getPilotName(f.pilot_id);
                htmlBody += `<li>${format(parseISO(f.date), 'dd/MM/yy')}: Instrucción a ${studentName} (${f.flight_duration_decimal.toFixed(1)} hs, ${f.logbook_type === 'engine' ? 'Motor' : 'Planeador'})</li>`;
            });
            htmlBody += '</ul>';
        }

        htmlBody += '<p>¡Buenos vuelos!</p><p>El equipo del Aeroclub 9 de Julio</p></div>';

        const recipients = [new Recipient(pilotEmail, data.pilotName)];
        const emailParams = new EmailParams()
          .setFrom(fromSender)
          .setTo(recipients)
          .setSubject(subject)
          .setHtml(htmlBody);

        const sendPromise = mailerSend.email.send(emailParams)
          .then(response => ({ pilotId, pilotName: data.pilotName, response }))
          .catch(error => ({ pilotId, pilotName: data.pilotName, error }));
          
        emailPromises.push(sendPromise);
    }
    
    // Add pilots with no activity to the status report
    pilots.forEach(p => {
        if (!activityByPilot.has(p.id) || (activityByPilot.get(p.id)!.picFlights.length === 0 && activityByPilot.get(p.id)!.instFlights.length === 0)) {
            statusDetails.push({ pilotId: p.id, pilotName: getPilotName(p.id), status: "no_activity" });
        }
    });

    // Wait for all emails to be sent and process results
    const results = await Promise.all(emailPromises);
    
    results.forEach(result => {
        if (result.error) {
             statusDetails.push({ pilotId: result.pilotId, pilotName: result.pilotName, status: "failed", error: result.error.message || "Unknown mailer error" });
        } else if (result.response.statusCode >= 200 && result.response.statusCode < 300) {
            statusDetails.push({ pilotId: result.pilotId, pilotName: result.pilotName, status: "sent" });
        } else {
             statusDetails.push({ pilotId: result.pilotId, pilotName: result.pilotName, status: "failed", error: `API Error: ${result.response.statusCode} - ${JSON.stringify(result.response.body)}` });
        }
    });

    const sentCount = statusDetails.filter(d => d.status === 'sent').length;
    const failedCount = statusDetails.filter(d => d.status === 'failed').length;

    return {
      sentCount,
      failedCount,
      details: statusDetails,
    };
  }
);
