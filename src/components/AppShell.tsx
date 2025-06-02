
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home, Users, Tags, Plane, CalendarDays, LogIn, LogOut } from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  pathname: string;
}

function NavItem({ href, icon, label, pathname }: NavItemProps) {
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuItem>
      <Link href={href} passHref legacyBehavior>
        <SidebarMenuButton
          onClick={handleClick}
          isActive={isActive}
          tooltip={label}
          className="justify-start data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
        >
          {icon}
          <span className="truncate">{label}</span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
}

// Internal component to use sidebar context
function AppShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const sidebar = useSidebar(); // Correctly called within a child of SidebarProvider

  const navItems = [
    { href: '/', label: 'Agenda', icon: <CalendarDays /> },
    { href: '/pilots', label: 'Pilotos', icon: <Users /> },
    { href: '/categories', label: 'Categorías', icon: <Tags /> },
    { href: '/aircraft', label: 'Aeronaves', icon: <Plane /> },
  ];

  const handleLogout = async () => {
    await logout();
    if (sidebar.isMobile) {
      sidebar.setOpenMobile(false);
    }
    router.push('/login');
  };

  return (
    <>
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
              <span className="text-xs text-sidebar-foreground/80 truncate w-full" title={user.email ?? undefined}>
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
                    <SidebarMenuButton
                        onClick={() => {
                            if (sidebar.isMobile) {
                                sidebar.setOpenMobile(false);
                            }
                        }}
                        isActive={pathname === '/login'}
                        className="justify-start"
                    >
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
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppShellLayout>{children}</AppShellLayout>
    </SidebarProvider>
  );
}
