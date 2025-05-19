"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ScheduleEntry } from "@/types";
import { usePilotsStore, usePilotCategoriesStore, useAircraftStore } from '@/store/data-hooks';
import { FLIGHT_TYPES } from '@/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';


interface ShareButtonProps {
  scheduleDate: Date;
  entries: ScheduleEntry[];
}

export function ShareButton({ scheduleDate, entries }: ShareButtonProps) {
  const { toast } = useToast();
  const { getPilotName } = usePilotsStore.getState(); // Access store state directly for non-reactive parts
  const { getCategoryName } = usePilotCategoriesStore.getState();
  const { getAircraftName } = useAircraftStore.getState();


  const generateShareText = () => {
    let text = `Agenda de Vuelo - ${format(scheduleDate, "PPP", { locale: es })}\n\n`;
    if (entries.length === 0) {
      text += "No hay turnos programados para esta fecha.";
    } else {
      entries.forEach(entry => {
        const pilotName = getPilotName(entry.pilotId);
        const categoryName = getCategoryName(entry.pilotCategoryId);
        const flightTypeName = FLIGHT_TYPES.find(ft => ft.id === entry.flightTypeId)?.name || 'N/A';
        const aircraftText = entry.aircraftId ? ` - Aeronave: ${getAircraftName(entry.aircraftId)}` : '';
        let towPilotStatus = '';
        if (categoryName === 'Piloto remolcador') {
          towPilotStatus = entry.isTowPilotAvailable ? ' (Disponible)' : ' (No Disponible)';
        }

        text += `${entry.startTime} - ${pilotName} (${categoryName}${towPilotStatus}) - ${flightTypeName}${aircraftText}\n`;
      });
    }
    return text;
  };

  const handleShare = async () => {
    const shareText = generateShareText();
    const shareData = {
      title: `Agenda de Vuelo - ${format(scheduleDate, "PPP", { locale: es })}`,
      text: shareText,
      // url: window.location.href, // Or a specific URL to the schedule if available
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({ title: "Agenda compartida", description: "La agenda se ha compartido exitosamente." });
      } catch (err) {
        console.error("Error al compartir:", err);
        // Fallback for when share is cancelled or fails
        // Attempt to copy to clipboard as a fallback
        try {
          await navigator.clipboard.writeText(shareText);
          toast({ title: "Enlace copiado", description: "No se pudo compartir, la agenda se copió al portapapeles." });
        } catch (copyError) {
          toast({ title: "Error al compartir", description: "No se pudo compartir ni copiar la agenda.", variant: "destructive" });
        }
      }
    } else {
      // Fallback for browsers that don't support navigator.share
       try {
        await navigator.clipboard.writeText(shareText);
        toast({ title: "Agenda copiada", description: "Tu navegador no soporta compartir directamente. La agenda se copió al portapapeles." });
      } catch (err) {
        toast({ title: "Error", description: "Tu navegador no soporta la función de compartir ni de copiar al portapapeles.", variant: "destructive" });
      }
    }
  };

  return (
    <Button onClick={handleShare} variant="outline">
      <Share2 className="mr-2 h-4 w-4" /> Compartir Agenda
    </Button>
  );
}
