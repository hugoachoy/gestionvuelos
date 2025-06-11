
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider
import { Toaster } from "@/components/ui/toaster"; // Moved Toaster here from AppShell

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Turnos de Vuelo',
  description: 'Gestión de Turnos de Vuelo a Vela para el Aeroclub 9 de Julio. Planifica y coordina tus vuelos de forma eficiente y segura.',
  // manifest: '/manifest.json', // Temporarily commented out for CORS diagnosis
  applicationName: 'Turnos de Vuelo',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default', 
    title: 'Turnos de Vuelo',
    // startupImage: [ // Opcional: imágenes de inicio para iOS
    //   { url: '/splash/iphone5_splash.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)' },
    // ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    shortcut: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png', 
  },
};

export const viewport: Viewport = {
  themeColor: '#87CEEB', 
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false, 
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
          <Toaster /> 
        </AuthProvider>
      </body>
    </html>
  );
}
