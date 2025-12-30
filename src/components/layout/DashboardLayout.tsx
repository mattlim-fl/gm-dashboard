
import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function DashboardLayout({ children, headerActions }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
  };

  // Function to get the current page breadcrumb from the route
  const getBreadcrumb = () => {
    const path = location.pathname;
    
    if (path === '/' || path === '/dashboard') return ['Dashboard'];
    if (path === '/calendar') return ['Calendar'];
    if (path === '/bookings') return ['Bookings'];
    if (path === '/bookings/create') return ['Bookings', 'Create'];
    if (path === '/customers') return ['Customers'];
    if (path === '/revenue') return ['Revenue'];
    if (path === '/pnl') return ['Profit & Loss'];
    if (path === '/reports') return ['Reports'];
    if (path === '/settings') return ['Settings'];
    if (path === '/run-sheet') return ['Run Sheet'];
    if (path === '/occasions') return ['Occasions'];
    if (path === '/design') return ['Design System'];
    if (path === '/api-test') return ['API Test'];
    if (path === '/feature-flags') return ['Feature Flags'];
    
    // Fallback for any other routes
    return [path.charAt(1).toUpperCase() + path.slice(2)];
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
              <SidebarTrigger />
              <nav className="flex items-center space-x-2 text-sm text-gm-neutral-500">
                <span>GM Staff Portal</span>
                {getBreadcrumb().map((crumb, index) => (
                  <span key={index} className="flex items-center space-x-2">
                    <span>/</span>
                    <span className={index === getBreadcrumb().length - 1 ? "text-gm-neutral-900" : "text-gm-neutral-500"}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {headerActions}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user?.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="p-6">
            {children}
          </div>
        </main>
    </SidebarProvider>
  );
}
