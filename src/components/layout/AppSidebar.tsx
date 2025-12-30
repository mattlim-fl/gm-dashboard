
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Home, Users, BarChart3, Settings, CalendarDays, DollarSign, Building, ListChecks, Calendar, PartyPopper } from "lucide-react";
import { Link } from "react-router-dom";

import { LastSyncIndicator } from "./LastSyncIndicator";
import { ThemeToggle } from "./ThemeToggle";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/permissions";

const financeItems = [
  {
    title: "Revenue",
    url: "/revenue",
    icon: DollarSign,
  },
  {
    title: "Profit & Loss",
    url: "/pnl",
    icon: BarChart3,
  },
];

const operationsItems = [
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
  },
  {
    title: "Run Sheet",
    url: "/run-sheet",
    icon: ListChecks,
  },
  {
    title: "Bookings",
    url: "/bookings",
    icon: CalendarDays,
  },
  {
    title: "Occasions",
    url: "/occasions",
    icon: PartyPopper,
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
  },
];

export function AppSidebar() {
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>();
  const { role } = useAuth();
  const isAdminUser = isAdmin(role);

  const fetchLastSyncTime = async () => {
    try {
      // Get the most recent sync time from any location
      const { data, error } = await supabase
        .from('square_location_sync_status')
        .select('last_successful_sync_at')
        .order('last_successful_sync_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data?.last_successful_sync_at) {
        setLastSyncTime(data.last_successful_sync_at);
      }
    } catch (_error) {
      // Silent fail for last sync time fetch
    }
  };

  useEffect(() => {
    fetchLastSyncTime();
  }, []);



  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Dashboard - standalone (admins only) */}
        {isAdminUser && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dashboard">
                    <Link to="/dashboard">
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Finance Section (admins only) */}
        {isAdminUser && (
          <SidebarGroup>
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {financeItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Operations Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Booth Management">
                  <Link to="/booth-management">
                    <Building className="h-4 w-4" />
                    <span>Booth Management</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <Link to="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Team">
                  <Link to="/team">
                    <Users className="h-4 w-4" />
                    <span>Team</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="space-y-2">
          <ThemeToggle />
          {isAdminUser && (
            <LastSyncIndicator
              lastSyncTime={lastSyncTime}
              onSyncComplete={fetchLastSyncTime}
            />
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
