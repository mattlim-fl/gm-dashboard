import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/currencyUtils";
import { findSaturdayInRange, getSameSaturdayLastYear } from "@/lib/saturday-utils";

export interface RevenueMetrics {
  current: number;
  previous: number;
  previousYear: number;
  currentFormatted: string;
  previousFormatted: string;
  previousYearFormatted: string;
  changePercent: number;
  changePercentYear: number;
  currentAttendance: number;
  previousAttendance: number;
  previousYearAttendance: number;
  currentSpendPerHead: number;
  previousSpendPerHead: number;
  previousYearSpendPerHead: number;
  currentSpendPerHeadFormatted: string;
  previousSpendPerHeadFormatted: string;
  previousYearSpendPerHeadFormatted: string;
  attendanceChangePercent: number;
  attendanceChangePercentYear: number;
  spendPerHeadChangePercent: number;
  spendPerHeadChangePercentYear: number;
}

export interface DashboardData {
  weekly: RevenueMetrics;
  monthly: RevenueMetrics;
  yearly: RevenueMetrics;
}

const createEmptyMetrics = (): RevenueMetrics => ({
  current: 0,
  previous: 0,
  previousYear: 0,
  currentFormatted: '$0',
  previousFormatted: '$0',
  previousYearFormatted: '$0',
  changePercent: 0,
  changePercentYear: 0,
  currentAttendance: 0,
  previousAttendance: 0,
  previousYearAttendance: 0,
  currentSpendPerHead: 0,
  previousSpendPerHead: 0,
  previousYearSpendPerHead: 0,
  currentSpendPerHeadFormatted: '$0.00',
  previousSpendPerHeadFormatted: '$0.00',
  previousYearSpendPerHeadFormatted: '$0.00',
  attendanceChangePercent: 0,
  attendanceChangePercentYear: 0,
  spendPerHeadChangePercent: 0,
  spendPerHeadChangePercentYear: 0
});

const getDirectRevenueForPeriod = async (
  startDate: Date,
  endDate: Date,
  venueFilter: string | null = null
): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('get_revenue_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: venueFilter
    });

    if (error) {
      return 0;
    }

    return data || 0;
  } catch (_error) {
    return 0;
  }
};

const getAttendanceForPeriod = async (
  startDate: Date,
  endDate: Date,
  venueFilter: string | null = null
): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('get_attendance_sum', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_filter: venueFilter
    });

    if (error) {
      return 0;
    }

    return data || 0;
  } catch (_error) {
    return 0;
  }
};

const calculateRollingFromWeeklyRPC = async (
  daysBack: number,
  venueFilter: string | null
): Promise<RevenueMetrics> => {
  try {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    const previousCutoffDate = new Date(now.getTime() - (daysBack * 2 * 24 * 60 * 60 * 1000));

    // Year-over-Year: use Saturday numbering for meaningful comparison
    // Find the Saturday in the current period and get the corresponding Saturday from last year
    const currentSaturday = findSaturdayInRange(cutoffDate, now);
    const yearAgoSaturday = currentSaturday ? getSameSaturdayLastYear(currentSaturday) : null;

    let yearAgoCutoffDate: Date;
    let yearAgoEndDate: Date;

    if (yearAgoSaturday) {
      // Center the year-ago period around the corresponding Saturday
      yearAgoEndDate = new Date(yearAgoSaturday);
      yearAgoEndDate.setHours(23, 59, 59, 999);
      yearAgoCutoffDate = new Date(yearAgoEndDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    } else {
      // Fallback: calendar year subtraction
      yearAgoCutoffDate = new Date(cutoffDate);
      yearAgoCutoffDate.setFullYear(yearAgoCutoffDate.getFullYear() - 1);
      yearAgoEndDate = new Date(now);
      yearAgoEndDate.setFullYear(yearAgoEndDate.getFullYear() - 1);
    }

    // Simple revenue queries
    const [currentRevenue, previousRevenue, yearAgoRevenue] = await Promise.all([
      getDirectRevenueForPeriod(cutoffDate, now, venueFilter),
      getDirectRevenueForPeriod(previousCutoffDate, cutoffDate, venueFilter),
      getDirectRevenueForPeriod(yearAgoCutoffDate, yearAgoEndDate, venueFilter)
    ]);

    // Simple attendance queries - just sum door_ticket_qty for each period
    const [currentAttendance, previousAttendance, yearAgoAttendance] = await Promise.all([
      getAttendanceForPeriod(cutoffDate, now, venueFilter),
      getAttendanceForPeriod(previousCutoffDate, cutoffDate, venueFilter),
      getAttendanceForPeriod(yearAgoCutoffDate, yearAgoEndDate, venueFilter)
    ]);

    // Calculate spend per head
    const currentSpendPerHead = currentAttendance > 0 ? (currentRevenue / 100) / currentAttendance : 0;
    const previousSpendPerHead = previousAttendance > 0 ? (previousRevenue / 100) / previousAttendance : 0;
    const yearAgoSpendPerHead = yearAgoAttendance > 0 ? (yearAgoRevenue / 100) / yearAgoAttendance : 0;

    // Calculate change percentages
    const changePercent = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const changePercentYear = yearAgoRevenue > 0 ? ((currentRevenue - yearAgoRevenue) / yearAgoRevenue) * 100 : 0;
    const attendanceChangePercent = previousAttendance > 0 ? ((currentAttendance - previousAttendance) / previousAttendance) * 100 : 0;
    const attendanceChangePercentYear = yearAgoAttendance > 0 ? ((currentAttendance - yearAgoAttendance) / yearAgoAttendance) * 100 : 0;
    const spendPerHeadChangePercent = previousSpendPerHead > 0 ? ((currentSpendPerHead - previousSpendPerHead) / previousSpendPerHead) * 100 : 0;
    const spendPerHeadChangePercentYear = yearAgoSpendPerHead > 0 ? ((currentSpendPerHead - yearAgoSpendPerHead) / yearAgoSpendPerHead) * 100 : 0;

    return {
      current: currentRevenue,
      previous: previousRevenue,
      previousYear: yearAgoRevenue,
      currentFormatted: formatCurrency(currentRevenue, { inputInCents: true }),
      previousFormatted: formatCurrency(previousRevenue, { inputInCents: true }),
      previousYearFormatted: formatCurrency(yearAgoRevenue, { inputInCents: true }),
      changePercent,
      changePercentYear,
      currentAttendance,
      previousAttendance,
      previousYearAttendance: yearAgoAttendance,
      currentSpendPerHead,
      previousSpendPerHead,
      previousYearSpendPerHead: yearAgoSpendPerHead,
      currentSpendPerHeadFormatted: `$${currentSpendPerHead.toFixed(2)}`,
      previousSpendPerHeadFormatted: `$${previousSpendPerHead.toFixed(2)}`,
      previousYearSpendPerHeadFormatted: `$${yearAgoSpendPerHead.toFixed(2)}`,
      attendanceChangePercent,
      attendanceChangePercentYear,
      spendPerHeadChangePercent,
      spendPerHeadChangePercentYear
    };

  } catch (_error) {
    return createEmptyMetrics();
  }
};

export function useRevenueMetrics() {
  const query = useQuery({
    queryKey: ['revenue-metrics'],
    queryFn: async (): Promise<DashboardData> => {
      // Dashboard stats always use ALL venues (no filtering)
      const venueFilter = null;

      // Use RPC approach for ALL periods - same as revenue chart
      const [weeklyData, monthlyData, yearlyData] = await Promise.all([
        calculateRollingFromWeeklyRPC(7, venueFilter),    // Use weekly RPC for 7 days
        calculateRollingFromWeeklyRPC(28, venueFilter),   // Use weekly RPC for 28 days
        calculateRollingFromWeeklyRPC(365, venueFilter)   // Use weekly RPC for 365 days
      ]);

      return {
        weekly: weeklyData,
        monthly: monthlyData,
        yearly: yearlyData
      };
    },
    staleTime: 1000 * 60 * 5,  // 5 minutes - data doesn't change frequently
    gcTime: 1000 * 60 * 30,    // 30 minutes - keep in cache
  });

  return {
    dashboardData: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

