
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Sunrise, Sunset, Info } from 'lucide-react';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Interfaces updated to match the actual combined API structure ---
interface Notam {
  ad: string;
  indicador: string;
  notam: string; // The unique identifier "C1135/2025"
  desde: string; // "2025-07-11 12:03:00"
  hasta: string; // "2025-10-03 23:59:00"
  novedad: string; // The NOTAM text
}

interface Coordinates {
    lat: number;
    lng: number;
}

interface Localization {
    elevation: number;
    coordinates: Coordinates;
}

interface Identifiers {
    icao: string;
    local: string;
    iata: string | null;
}

interface Metadata {
    localization: Localization;
    identifiers: Identifiers;
}

interface Datos {
    rwy: (string | null)[];
}

interface AirportData {
    human_readable_identifier: string;
    notam: Notam[];
    metadata: Metadata;
    data: Datos;
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

const parseCustomDate = (dateString: string) => {
    // Tries to parse "YYYY-MM-DD HH:mm:ss"
    return parse(dateString, "yyyy-MM-dd HH:mm:ss", new Date());
};

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
                   {airportData.metadata?.localization?.coordinates?.lat && <InfoPill key="lat" title="Latitud" value={airportData.metadata.localization.coordinates.lat.toFixed(4)} icon={<Sunrise />} />}
                   {airportData.metadata?.localization?.coordinates?.lng && <InfoPill key="lng" title="Longitud" value={airportData.metadata.localization.coordinates.lng.toFixed(4)} icon={<Sunset />} />}
                   {airportData.metadata?.localization?.elevation && <InfoPill key="elev" title="Elevación" value={`${airportData.metadata.localization.elevation} m`} icon={<Sunrise />} />}
                   {airportData.data?.rwy?.[0] && <React.Fragment key="rwy"><InfoPill title="Pista Principal" value={(airportData.data.rwy[0] || '').split(' ')[0]} icon={<Sunset />} /></React.Fragment>}
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
                                <h3 className="font-bold text-lg mb-2">Pista {(runwayString || '').split(' ')[0]}</h3>
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
                    <CardContent className="space-y-4">
                        {airportData.notam.map((notam) => (
                            <div key={notam.notam} className="p-4 border rounded-lg bg-muted/50">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                                    <Badge variant="outline" className="text-base font-semibold mb-2 sm:mb-0">{notam.notam}</Badge>
                                    <div className="text-xs text-muted-foreground space-y-1 sm:space-y-0 sm:space-x-4 sm:flex">
                                        <span><strong>Desde:</strong> {notam.desde ? format(parseCustomDate(notam.desde), "dd/MM/yy HH:mm", { locale: es }) : 'N/A'}</span>
                                        <span><strong>Hasta:</strong> {notam.hasta ? format(parseCustomDate(notam.hasta), "dd/MM/yy HH:mm", { locale: es }) : 'N/A'}</span>
                                    </div>
                                </div>
                                <hr className="my-2"/>
                                <p className="whitespace-pre-wrap font-mono text-sm">
                                    {notam.novedad}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
