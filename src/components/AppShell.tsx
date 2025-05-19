
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
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
} from '@/components/ui/sidebar'; // Using the custom sidebar from ui
import { Button } from '@/components/ui/button';
import { Home, Users, Tags, Plane, Settings, Feather, CalendarDays } from 'lucide-react';
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
            <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10">
              <Feather className="h-7 w-7" />
            </Button>
            <h1 className="text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">
              TurnoVuelo
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
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1 text-center text-3xl font-semibold text-primary">
            Aeroclub 9 de Julio
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
