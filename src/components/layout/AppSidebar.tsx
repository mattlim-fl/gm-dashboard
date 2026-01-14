
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Home, Calendar, Users, BarChart3, Settings, CalendarDays, DollarSign, Building, ListChecks, PartyPopper, Users2, Image } from "lucide-react";
import { Link } from "react-router-dom";

import { LastSyncIndicator } from "./LastSyncIndicator";
import { ThemeToggle } from "./ThemeToggle";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canViewFinancial, canManageTeam, isAdmin } from "@/lib/permissions";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const dashboardItem: MenuItem = {
  title: "Dashboard",
  url: "/dashboard",
  icon: Home,
};

const financeItems: MenuItem[] = [
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

const operationsItems: MenuItem[] = [
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

const contentItems: MenuItem[] = [
  {
    title: "Photos",
    url: "/photos",
    icon: Image,
  },
];

const settingsItems: MenuItem[] = [
  {
    title: "Booth Management",
    url: "/booth-management",
    icon: Building,
  },
  {
    title: "Settings", 
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Team",
    url: "/team",
    icon: Users2,
  },
];

export function AppSidebar() {
  const { role } = useAuth();
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>();

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
    } catch (error) {
      console.error('Error fetching last sync time:', error);
    }
  };

  useEffect(() => {
    fetchLastSyncTime();
  }, []);



  const renderMenuItems = (items: MenuItem[]) => (
    <SidebarMenu>
      {items.map((item) => (
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
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Dashboard - Standalone - Only show for admins */}
        {isAdmin(role) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={dashboardItem.title}>
                    <Link to={dashboardItem.url}>
                      <dashboardItem.icon className="h-4 w-4" />
                      <span>{dashboardItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Finance Section - Only show if admin */}
        {canViewFinancial(role) && (
          <SidebarGroup>
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(financeItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Operations Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(operationsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Content Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Content</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(contentItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(
              settingsItems.filter(item => 
                item.url !== '/team' || canManageTeam(role)
              )
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="space-y-2">
          <ThemeToggle />
          <LastSyncIndicator lastSyncTime={lastSyncTime} onSyncComplete={fetchLastSyncTime} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
