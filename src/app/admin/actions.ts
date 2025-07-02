
'use server';

import { sendWeeklySummary } from '@/ai/flows/send-weekly-summary';
import type { WeeklySummaryStatus } from '@/types';

export async function triggerWeeklySummary(): Promise<WeeklySummaryStatus> {
  // Aquí podríamos añadir lógica de permisos adicional si fuera necesario.
  // Por ahora, la página está restringida a administradores.
  console.log("Triggering weekly summary flow from server action...");
  const result = await sendWeeklySummary();
  console.log("Weekly summary flow completed with result:", result);
  return result;
}
