
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
// Removed: import Image from 'next/image'; 
import { usePathname } from 'next/navigation';
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
import { Home, Users, Tags, Plane, Settings, CalendarDays } from 'lucide-react';
import { Toaster } from "@/components/ui/toaster";

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
        <SidebarMenuButton isActive={isActive} tooltip={label} className="justify-start">
          {icon}
          <span className="truncate">{label}</span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Agenda', icon: <CalendarDays /> },
    { href: '/pilots', label: 'Pilotos', icon: <Users /> },
    { href: '/categories', label: 'Categorías', icon: <Tags /> },
    { href: '/aircraft', label: 'Aeronaves', icon: <Plane /> },
  ];

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
          {/* Optional: Settings or User Profile Link */}
          {/* <NavItem href="/settings" icon={<Settings />} label="Settings" pathname={pathname} /> */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:h-16 md:px-6">
          <SidebarTrigger className="md:hidden" />
          {/* Container for text, centered */}
          <div className="flex flex-1 items-center justify-center"> {/* Removed gap-3 */}
            {/* Logo Image removed from here */}
            <div className="text-4xl font-semibold text-primary drop-shadow-md">
              Aeroclub 9 de Julio
            </div>
          </div>
          {/* Optional: User Avatar/Menu */}
        </header>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
