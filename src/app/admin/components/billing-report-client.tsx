
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePilotsStore, useAircraftStore, useCompletedEngineFlightsStore, useCompletedGliderFlightsStore } from '@/store/data-hooks';
import type { CompletedEngineFlight, CompletedGliderFlight } from '@/types';
import { FLIGHT_PURPOSE_DISPLAY_MAP } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
  TableCaption,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarIcon, FileText, Loader2, Check, ChevronsUpDown, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Link from 'next/link';


export function BillingReportClient() {
  const { user: currentUser } = useAuth();
  
  if (!currentUser?.is_admin) {
    return (
       <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Acceso Denegado</AlertTitle>
            <AlertDescription>Esta sección está disponible solo para administradores. Los informes de facturación se han movido a la sección de <Link href="/logbook/reports/billing" className="font-semibold underline">Informes del Libro de Vuelo</Link>.</AlertDescription>
        </Alert>
    );
  }

  return (
    <Alert variant="default" className="border-blue-500 bg-blue-50 text-blue-800">
      <AlertTriangle className="h-4 w-4 !text-blue-600" />
      <AlertTitle>Componente Movido</AlertTitle>
      <AlertDescription>
        El informe de facturación ahora se encuentra en la sección de <Link href="/logbook/reports/billing" className="font-semibold underline hover:text-blue-700">Informes del Libro de Vuelo</Link> para unificar todos los reportes.
      </AlertDescription>
    </Alert>
  );
}
