
import { supabase } from "@/integrations/supabase/client";
import { fetchPnl, PnlResponse } from "./xeroService";
import { startOfWeek, endOfWeek, subWeeks, format, addDays } from "date-fns";
import { bookingService } from "./bookingService";

interface WeeklyRevenueRow {
  week_start: string;
  total_revenue_cents: number;
}

export interface WeeklyFinancials {
  weekStart: string;
  weekEnd: string;
  revenue: number;
  wages: number;
  cogs: number;
  security: number;
  marketing: number;
  otherExpenses: number;
  totalExpenses: number;
  netProfit: number;
  marginPercent: number;
}

export interface FinancialKPIs {
  revenue: { total: number; previousTotal: number; changePercent: number };
  netProfit: { total: number; previousTotal: number; marginPercent: number; previousMarginPercent: number; changePercent: number };
  attendance: { total: number; previousTotal: number; changePercent: number };
  spendPerHead: { total: number; previousTotal: number; changePercent: number };
  wages: { total: number; previousTotal: number; percentOfRevenue: number; previousPercentOfRevenue: number; changePercent: number };
  cogs: { total: number; previousTotal: number; percentOfRevenue: number; previousPercentOfRevenue: number; changePercent: number };
  security: { total: number; previousTotal: number; percentOfRevenue: number; previousPercentOfRevenue: number; changePercent: number };
  bookings: { 
    total: number; 
    changePercent: number;
    breakdown: { tickets: number; karaoke: number; venueHire: number };
  };
}

export const financialService = {
  async fetchWeeklyFinancials(weeksBack: number = 8): Promise<WeeklyFinancials[]> {
    try {
      const today = new Date();
      // Align to start of current week (Monday)
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      
      // Generate week ranges
      const weeks = Array.from({ length: weeksBack }).map((_, i) => {
        const start = subWeeks(currentWeekStart, i);
        const end = endOfWeek(start, { weekStartsOn: 1 });
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          dateObj: start
        };
      }).reverse(); // Oldest first

      // 1. Fetch Revenue (using RPC or direct query)
      // We'll use the RPC if possible, but we need to filter by specific weeks.
      // Alternatively, we can fetch all revenue for the period and aggregate in JS.
      const startDate = weeks[0].start;
      const endDate = weeks[weeks.length - 1].end;

      const { data: revenueData, error: revenueError } = await supabase.rpc('get_weekly_revenue_summary', {
        venue_filter: null,
        week_date: null 
      });

      if (revenueError) {
        throw new Error('Failed to fetch revenue data');
      }

      // 2. Fetch Costs (Xero P&L for each week)
      // Run in parallel
      const costPromises = weeks.map(week => 
        fetchPnl(week.start, week.end)
          .catch(_err => {
            return null;
          })
      );

      const costResults = await Promise.all(costPromises);

      // 3. Combine Data
      const financials: WeeklyFinancials[] = weeks.map((week, index) => {
        // Find revenue for this week
        // RPC returns `week_start` as timestamp string
        const weekRevenueRow = (revenueData as WeeklyRevenueRow[] | null)?.find((r) => {
          const rowDate = new Date(r.week_start);
          return format(rowDate, 'yyyy-MM-dd') === week.start;
        });

        const revenueCents = weekRevenueRow?.total_revenue_cents || 0;
        // Convert cents to dollars (GST-inclusive / net sales)
        const revenue = revenueCents / 100;

        const costs = costResults[index];
        
        // Extract categories
        let wages = 0;
        let cogs = 0;
        let security = 0;
        let marketing = 0;
        let totalExpenses = 0;

        if (costs) {
          const cats = costs.categories || {};
          wages = cats['wages'] || 0;
          cogs = cats['cogs'] || 0;
          security = cats['security'] || 0;
          marketing = cats['marketing'] || 0; // If mapped
          
          totalExpenses = costs.totals.expenses;
        }

        const otherExpenses = totalExpenses - (wages + cogs + security + marketing);
        const netProfit = revenue - totalExpenses;
        const marginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        return {
          weekStart: week.start,
          weekEnd: week.end,
          revenue,
          wages,
          cogs,
          security,
          marketing,
          otherExpenses,
          totalExpenses,
          netProfit,
          marginPercent
        };
      });

      return financials;

    } catch (error) {
      throw error;
    }
  },

  async fetchKPIs(daysBack: number = 28): Promise<FinancialKPIs> {
    // Use rolling days (same as Revenue page) instead of aligned weeks
    const now = new Date();
    const currentStart = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    const previousStart = new Date(now.getTime() - (daysBack * 2 * 24 * 60 * 60 * 1000));
    
    // Fetch revenue and attendance using the same RPC as Revenue page
    const [currentRevenueCents, previousRevenueCents, currentAttendance, previousAttendance] = await Promise.all([
      this.getRevenueForPeriod(currentStart, now),
      this.getRevenueForPeriod(previousStart, currentStart),
      this.getAttendanceForPeriod(currentStart, now),
      this.getAttendanceForPeriod(previousStart, currentStart)
    ]);
    
    // Convert cents to dollars (GST-inclusive / net sales)
    const currentRevenue = currentRevenueCents / 100;
    const previousRevenue = previousRevenueCents / 100;

    // Calculate spend per head (revenue in dollars / attendance)
    const currentSpendPerHead = currentAttendance > 0 ? (currentRevenueCents / 100) / currentAttendance : 0;
    const previousSpendPerHead = previousAttendance > 0 ? (previousRevenueCents / 100) / previousAttendance : 0;

    // Fetch costs from Xero P&L for the same periods
    const [currentCosts, previousCosts] = await Promise.all([
      fetchPnl(format(currentStart, 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd')).catch(() => null),
      fetchPnl(format(previousStart, 'yyyy-MM-dd'), format(currentStart, 'yyyy-MM-dd')).catch(() => null)
    ]);
    
    // Extract current period costs
    const currentWages = currentCosts?.categories?.wages || 0;
    const currentCogs = currentCosts?.categories?.cogs || 0;
    const currentSecurity = currentCosts?.categories?.security || 0;
    const currentTotalExpenses = currentCosts?.totals?.expenses || 0;
    const currentNetProfit = currentRevenue - currentTotalExpenses;
    
    // Extract previous period costs
    const previousWages = previousCosts?.categories?.wages || 0;
    const previousCogs = previousCosts?.categories?.cogs || 0;
    const previousSecurity = previousCosts?.categories?.security || 0;
    const previousTotalExpenses = previousCosts?.totals?.expenses || 0;
    const previousNetProfit = previousRevenue - previousTotalExpenses;

    const revenueChange = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    const attendanceChange = previousAttendance > 0
      ? ((currentAttendance - previousAttendance) / previousAttendance) * 100
      : 0;

    const spendPerHeadChange = previousSpendPerHead > 0
      ? ((currentSpendPerHead - previousSpendPerHead) / previousSpendPerHead) * 100
      : 0;

    const wagePercent = currentRevenue > 0 ? (currentWages / currentRevenue) * 100 : 0;
    const cogsPercent = currentRevenue > 0 ? (currentCogs / currentRevenue) * 100 : 0;
    const securityPercent = currentRevenue > 0 ? (currentSecurity / currentRevenue) * 100 : 0;
    const netProfitMargin = currentRevenue > 0 ? (currentNetProfit / currentRevenue) * 100 : 0;
    const previousNetProfitMargin = previousRevenue > 0 ? (previousNetProfit / previousRevenue) * 100 : 0;

    // Calculate change percentages
    const netProfitChange = previousNetProfit !== 0
      ? ((currentNetProfit - previousNetProfit) / Math.abs(previousNetProfit)) * 100
      : 0;
    
    const wagePercentPrevious = previousRevenue > 0 ? (previousWages / previousRevenue) * 100 : 0;
    const wagePercentChange = wagePercentPrevious > 0
      ? ((wagePercent - wagePercentPrevious) / wagePercentPrevious) * 100
      : 0;
    
    const cogsPercentPrevious = previousRevenue > 0 ? (previousCogs / previousRevenue) * 100 : 0;
    const cogsPercentChange = cogsPercentPrevious > 0
      ? ((cogsPercent - cogsPercentPrevious) / cogsPercentPrevious) * 100
      : 0;
    
    const securityPercentPrevious = previousRevenue > 0 ? (previousSecurity / previousRevenue) * 100 : 0;
    const securityPercentChange = securityPercentPrevious > 0
      ? ((securityPercent - securityPercentPrevious) / securityPercentPrevious) * 100
      : 0;

    // Fetch bookings for the same periods
    const [currentBookings, previousBookings] = await Promise.all([
      bookingService.getBookings({
        dateFrom: format(currentStart, 'yyyy-MM-dd'),
        dateTo: format(now, 'yyyy-MM-dd'),
        status: 'confirmed'
      }),
      bookingService.getBookings({
        dateFrom: format(previousStart, 'yyyy-MM-dd'),
        dateTo: format(currentStart, 'yyyy-MM-dd'),
        status: 'confirmed'
      })
    ]);

    // Calculate booking breakdown for current period
    const currentBreakdown = {
      tickets: currentBookings.filter(b => b.booking_type === 'vip_tickets').length,
      karaoke: currentBookings.filter(b => b.booking_type === 'karaoke_booking').length,
      venueHire: currentBookings.filter(b => b.booking_type === 'venue_hire').length
    };

    const currentTotalBookings = currentBookings.length;
    const previousTotalBookings = previousBookings.length;

    const bookingsChange = previousTotalBookings > 0
      ? ((currentTotalBookings - previousTotalBookings) / previousTotalBookings) * 100
      : 0;

    return {
      revenue: {
        total: currentRevenue,
        previousTotal: previousRevenue,
        changePercent: revenueChange
      },
      netProfit: {
        total: currentNetProfit,
        previousTotal: previousNetProfit,
        marginPercent: netProfitMargin,
        previousMarginPercent: previousNetProfitMargin,
        changePercent: netProfitChange
      },
      attendance: {
        total: currentAttendance,
        previousTotal: previousAttendance,
        changePercent: attendanceChange
      },
      spendPerHead: {
        total: currentSpendPerHead,
        previousTotal: previousSpendPerHead,
        changePercent: spendPerHeadChange
      },
      wages: {
        total: currentWages,
        previousTotal: previousWages,
        percentOfRevenue: wagePercent,
        previousPercentOfRevenue: wagePercentPrevious,
        changePercent: wagePercentChange
      },
      cogs: {
        total: currentCogs,
        previousTotal: previousCogs,
        percentOfRevenue: cogsPercent,
        previousPercentOfRevenue: cogsPercentPrevious,
        changePercent: cogsPercentChange
      },
      security: {
        total: currentSecurity,
        previousTotal: previousSecurity,
        percentOfRevenue: securityPercent,
        previousPercentOfRevenue: securityPercentPrevious,
        changePercent: securityPercentChange
      },
      bookings: {
        total: currentTotalBookings,
        changePercent: bookingsChange,
        breakdown: currentBreakdown
      }
    };
  },

  // Helper to get revenue for a period using the same RPC as Revenue page
  async getRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
    const { data, error } = await supabase.rpc('get_revenue_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: null
    });
    
    if (error) {
      return 0;
    }
    
    return data || 0;
  },

  // Helper to get attendance for a period using the same RPC as Revenue page
  async getAttendanceForPeriod(startDate: Date, endDate: Date): Promise<number> {
    const { data, error } = await supabase.rpc('get_attendance_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: null
    });
    
    if (error) {
      return 0;
    }
    
    return data || 0;
  }
};

