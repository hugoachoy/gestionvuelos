
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Compass, MapPin, PlaneTakeoff, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Interfaces updated to match the actual combined API structure ---

// Interface for a single NOTAM from ais.anac.gob.ar/notam/json
interface Notam {
    id: number;
    numero: string;
    fecha_publicacion: string;
    valido_desde: string;
    valido_hasta: string;
    texto: string;
    // Other fields from the NOTAM API can be added here if needed
}

// Interfaces for data from datos.anac.gob.ar
interface Coordinates {
    lat: number;
    lng: number;
}

interface Localization {
    elevation: number;
    coordinates: Coordinates;
}

interface Metadata {
    localization: Localization;
    identifiers: {
        icao: string;
        local: string;
        iata: string | null;
    };
}

interface Data {
    rwy: string[];
}

interface AirportData {
    human_readable_identifier: string;
    notam: Notam[]; // This will be populated from the second API call
    metadata: Metadata;
    data: Data;
}

const API_URL = "/api/notams/";

function InfoPill({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-sm font-semibold text-muted-foreground">{title}</span>
            </div>
            <span className="text-lg font-bold text-foreground">{value}</span>
        </div>
    );
}

export function NotamClient() {
    const [airportData, setAirportData] = useState<AirportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Error de red: ${response.status} - ${response.statusText}`);
                }
                const data: AirportData = await response.json();
                setAirportData(data);
            } catch (e: any) {
                console.error("Failed to fetch NOTAM data:", e);
                setError(e.message || "No se pudo cargar la información del aeródromo.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-32 w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error al Cargar Datos</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (!airportData) {
        return (
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Sin Datos</AlertTitle>
                <AlertDescription>No se encontró información para el aeródromo LIO.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card>
                 <CardHeader>
                    <CardTitle>{airportData.human_readable_identifier ?? 'Aeródromo sin nombre'}</CardTitle>
                    <CardDescription>Información general del aeródromo.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoPill title="Latitud" value={airportData.metadata?.localization?.coordinates?.lat?.toFixed(4) ?? 'N/A'} icon={<MapPin />} />
                    <InfoPill title="Longitud" value={airportData.metadata?.localization?.coordinates?.lng?.toFixed(4) ?? 'N/A'} icon={<MapPin />} />
                    <InfoPill title="Elevación" value={`${airportData.metadata?.localization?.elevation ?? 'N/A'} m`} icon={<Compass />} />
                    {airportData.data?.rwy?.[0] && <InfoPill title="Pista Principal" value={airportData.data.rwy[0].split(' ')[0]} icon={<PlaneTakeoff />} />}
                </CardContent>
            </Card>

            {airportData.data?.rwy && airportData.data.rwy.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pistas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {airportData.data.rwy.map((runwayString, index) => (
                             <div key={index} className="p-3 border rounded-md mb-2 last:mb-0">
                                <h3 className="font-bold text-lg mb-2">Pista {runwayString.split(' ')[0]}</h3>
                                <p className="text-sm">{runwayString}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>NOTAMs Vigentes</CardTitle>
                    <CardDescription>
                        {airportData.notam && airportData.notam.length > 0 ? `Se encontraron ${airportData.notam.length} NOTAMs activos.` : "No hay NOTAMs activos para este aeródromo."}
                    </CardDescription>
                </CardHeader>
                {airportData.notam && airportData.notam.length > 0 && (
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {airportData.notam.map((notam) => (
                                <AccordionItem value={`item-${notam.id}`} key={notam.id}>
                                    <AccordionTrigger>
                                        <div className="flex flex-col md:flex-row md:items-center gap-x-4 gap-y-1 text-left">
                                            <Badge variant="outline">{notam.numero}</Badge>
                                            <span className="text-sm truncate">
                                                {notam.texto.split('\n')[0]}...
                                            </span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="whitespace-pre-wrap font-mono text-xs bg-muted/50 p-4 rounded-md">
                                        <p><strong>Válido Desde:</strong> {format(parseISO(notam.valido_desde), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                                        <p><strong>Válido Hasta:</strong> {format(parseISO(notam.valido_hasta), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                                        <p><strong>Publicado:</strong> {format(parseISO(notam.fecha_publicacion), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                                        <hr className="my-2"/>
                                        {notam.texto}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
