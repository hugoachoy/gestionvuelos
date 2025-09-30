
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Compass, MapPin, PlaneTakeoff, Info } from 'lucide-react';

interface AirportData {
    fir: string;
    iata: string;
    icao: string;
    name: string;
    city: string;
    state: string;
    country: string;
    elevation: number;
    lat: number;
    lon: number;
    tz: string;
    notams: Notam[];
    runways: Runway[];
    comms: Comm[];
    vor: Vor[];
    ndb: Ndb[];
}

interface Notam {
    id: string;
    text: string;
    end?: string;
    start?: string;
    created?: string;
    source?: string;
}

interface Runway {
    ident: string;
    name: string;
    sfc: string;
    len: number;
    wid: number;
    hdg: number;
    thr: Thr[];
}

interface Thr {
    ident: string;
    lat: number;
    lon: number;
}

interface Comm {
    type: string;
    freq: number;
    name: string;
}

interface Vor {
    id: string;
    name: string;
    freq: number;
    lat: number;
    lon: number;
}

interface Ndb {
    id: string;
    name: string;
    freq: number;
    lat: number;
    lon: number;
}

const API_URL = "/api/notams/"; // Use the local API route

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
                    throw new Error(`Error de red: ${response.status} - ${response.statusText}`);
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
                    <CardTitle>{airportData.name ?? 'Aeródromo sin nombre'} ({airportData.city ?? 'N/A'})</CardTitle>
                    <CardDescription>Información general del aeródromo.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoPill title="Latitud" value={airportData.lat?.toFixed(4) ?? 'N/A'} icon={<MapPin />} />
                    <InfoPill title="Longitud" value={airportData.lon?.toFixed(4) ?? 'N/A'} icon={<MapPin />} />
                    <InfoPill title="Elevación" value={`${airportData.elevation ?? 'N/A'} m`} icon={<Compass />} />
                    {airportData.runways && airportData.runways.length > 0 && <InfoPill title="Pista Principal" value={airportData.runways[0].ident} icon={<PlaneTakeoff />} />}
                </CardContent>
            </Card>

            {airportData.runways && airportData.runways.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pistas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {airportData.runways.map(runway => (
                             <div key={runway.ident} className="p-3 border rounded-md">
                                <h3 className="font-bold text-lg mb-2">Pista {runway.ident}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                    <p><strong className="font-semibold text-muted-foreground">Superficie:</strong> {runway.sfc}</p>
                                    <p><strong className="font-semibold text-muted-foreground">Longitud:</strong> {runway.len} m</p>
                                    <p><strong className="font-semibold text-muted-foreground">Ancho:</strong> {runway.wid} m</p>
                                    <p><strong className="font-semibold text-muted-foreground">Orientación:</strong> {runway.hdg}°</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>NOTAMs Vigentes</CardTitle>
                    <CardDescription>
                        {airportData.notams && airportData.notams.length > 0 ? `Se encontraron ${airportData.notams.length} NOTAMs activos.` : "No hay NOTAMs activos para este aeródromo."}
                    </CardDescription>
                </CardHeader>
                {airportData.notams && airportData.notams.length > 0 && (
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {airportData.notams.map((notam, index) => (
                                <AccordionItem value={`item-${index}`} key={notam.id}>
                                    <AccordionTrigger>
                                        <div className="flex flex-col md:flex-row md:items-center gap-x-4 gap-y-1 text-left">
                                            <Badge variant="outline" className="shrink-0">{notam.id}</Badge>
                                            <span className="text-sm truncate">
                                                {notam.text.split('\n')[0]}...
                                            </span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="whitespace-pre-wrap font-mono text-xs bg-muted/50 p-4 rounded-md">
                                        {notam.text}
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
