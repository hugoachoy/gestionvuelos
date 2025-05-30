
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Import useRouter
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home, Users, Tags, Plane, CalendarDays, LogIn, LogOut } from 'lucide-react'; // Import LogIn, LogOut
// import { Toaster } from "@/components/ui/toaster"; // Toaster se movió a layout.tsx

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  pathname: string;
}

function NavItem({ href, icon, label, pathname }: NavItemProps) {
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <SidebarMenuItem>
      <Link href={href} passHref legacyBehavior>
        <SidebarMenuButton isActive={isActive} tooltip={label} className="justify-start data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground">
          {icon}
          <span className="truncate">{label}</span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter(); // Hook de Next.js para navegación
  const { user, logout, loading: authLoading } = useAuth(); // Obtener estado de autenticación

  const navItems = [
    { href: '/', label: 'Agenda', icon: <CalendarDays /> },
    { href: '/pilots', label: 'Pilotos', icon: <Users /> },
    { href: '/categories', label: 'Categorías', icon: <Tags /> },
    { href: '/aircraft', label: 'Aeronaves', icon: <Plane /> },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login'); // Redirigir a la página de login después de cerrar sesión
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2">
            <svg
              className="h-7 w-7 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Turnos de Vuelo Logo"
            >
              <path d="M3 12L3 21L21 12L3 3L3 10L16 12L3 14L3 12Z" />
            </svg>
            <h1 className="text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">
              Turnos de Vuelo
            </h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <NavItem key={item.href} {...item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
          {authLoading ? (
            <div className="p-2 text-sm text-sidebar-foreground/70">Cargando...</div>
          ) : user ? (
            <div className="flex flex-col items-start gap-2 p-2">
              <span className="text-xs text-sidebar-foreground/80 truncate w-full" title={user.email}>
                {user.email}
              </span>
              <SidebarMenuButton onClick={handleLogout} className="w-full justify-start text-sm">
                <LogOut />
                Cerrar Sesión
              </SidebarMenuButton>
            </div>
          ) : (
             <SidebarMenuItem>
                <Link href="/login" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/login'} className="justify-start">
                    <LogIn />
                    Iniciar Sesión
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:h-16 md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex flex-1 items-center justify-center gap-3">
            {/* <Image src="/aeroclub_logo.png" alt="Aeroclub Logo" width={50} height={50} className="h-10 md:h-12 w-auto object-contain"/> */}
            <div className="text-4xl font-semibold text-primary drop-shadow-md">
              Aeroclub 9 de Julio
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
      {/* Toaster se movió a RootLayout para que esté disponible para el AuthProvider */}
    </SidebarProvider>
  );
}
