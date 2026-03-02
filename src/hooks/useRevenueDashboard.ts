import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useState, useCallback } from 'react';
import { findSaturdayInRange, getSameSaturdayLastYear } from '@/lib/saturday-utils';

export interface RevenueEvent {
  id: string;
  venue: string;
  revenue_type: 'bar' | 'door' | 'other';
  amount_cents: number;
  payment_date: string;
  status: string;
}

export interface PeriodMetrics {
  totalRevenue: number;
  barRevenue: number;
  doorRevenue: number;
  eventCount: number;
}

export interface ComparisonMetrics {
  totalVariance: number;
  barVariance: number;
  doorVariance: number;
}

export interface CoreStatistic {
  currentPeriod: PeriodMetrics;
  lastYearPeriod: PeriodMetrics;
  previousPeriod: PeriodMetrics;
  totalVariance: number;
  barVariance: number;
  doorVariance: number;
  previousPeriodVariance: number;
  periodLabel: string;
  currentDateRange: { start: Date; end: Date };
  lastYearDateRange: { start: Date; end: Date };
  previousDateRange: { start: Date; end: Date };
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Helper functions
async function fetchPeriodMetrics(startDate: Date, endDate: Date, venueFilter?: string | null): Promise<PeriodMetrics> {
  let query = supabase
    .from('revenue_events')
    .select('*')
    .eq('status', 'completed')
    .gte('payment_date', startDate.toISOString())
    .lte('payment_date', endDate.toISOString());
  
  if (venueFilter && venueFilter !== 'all') {
    query = query.eq('venue', venueFilter);
  }
  
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const events = (data || []) as RevenueEvent[];
  
  const totalRevenue = events.reduce((sum, event) => sum + event.amount_cents, 0);
  
  const barRevenue = events
    .filter(event => event.revenue_type === 'bar')
    .reduce((sum, event) => sum + event.amount_cents, 0);
  
  const doorRevenue = events
    .filter(event => event.revenue_type === 'door')
    .reduce((sum, event) => sum + event.amount_cents, 0);
  
  return { 
    totalRevenue, 
    barRevenue, 
    doorRevenue,
    eventCount: events.length
  };
}

function calculateVariance(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Fetcher for core statistics (Last 7, 28, 365 days)
async function fetchCoreStatisticsData(venueFilter?: string | null): Promise<CoreStatistic[]> {
  // Use the same date as the existing data (July 3, 2025)
  const now = new Date(2025, 6, 3); // July 3, 2025 (latest data)
  now.setHours(23, 59, 59, 999);

  const coreStats: CoreStatistic[] = [];

  // Last 7 days
  const last7DaysEnd = new Date(now);
  const last7DaysStart = new Date(now);
  last7DaysStart.setDate(last7DaysStart.getDate() - 6);
  last7DaysStart.setHours(0, 0, 0, 0);

  // Year-over-Year: use Saturday numbering for meaningful comparison
  const last7DaysSaturday = findSaturdayInRange(last7DaysStart, last7DaysEnd);
  const last7DaysYearAgoSaturday = last7DaysSaturday ? getSameSaturdayLastYear(last7DaysSaturday) : null;

  let last7DaysLastYearStart: Date;
  let last7DaysLastYearEnd: Date;

  if (last7DaysYearAgoSaturday) {
    last7DaysLastYearEnd = new Date(last7DaysYearAgoSaturday);
    last7DaysLastYearEnd.setHours(23, 59, 59, 999);
    last7DaysLastYearStart = new Date(last7DaysLastYearEnd);
    last7DaysLastYearStart.setDate(last7DaysLastYearStart.getDate() - 6);
    last7DaysLastYearStart.setHours(0, 0, 0, 0);
  } else {
    last7DaysLastYearEnd = new Date(last7DaysEnd);
    last7DaysLastYearEnd.setFullYear(last7DaysLastYearEnd.getFullYear() - 1);
    last7DaysLastYearStart = new Date(last7DaysStart);
    last7DaysLastYearStart.setFullYear(last7DaysLastYearStart.getFullYear() - 1);
  }

  // Last 28 days
  const last28DaysEnd = new Date(now);
  const last28DaysStart = new Date(now);
  last28DaysStart.setDate(last28DaysStart.getDate() - 27);
  last28DaysStart.setHours(0, 0, 0, 0);

  // Year-over-Year for 28 days: use Saturday numbering
  const last28DaysSaturday = findSaturdayInRange(last28DaysStart, last28DaysEnd);
  const last28DaysYearAgoSaturday = last28DaysSaturday ? getSameSaturdayLastYear(last28DaysSaturday) : null;

  let last28DaysLastYearStart: Date;
  let last28DaysLastYearEnd: Date;

  if (last28DaysYearAgoSaturday) {
    last28DaysLastYearEnd = new Date(last28DaysYearAgoSaturday);
    last28DaysLastYearEnd.setHours(23, 59, 59, 999);
    last28DaysLastYearStart = new Date(last28DaysLastYearEnd);
    last28DaysLastYearStart.setDate(last28DaysLastYearStart.getDate() - 27);
    last28DaysLastYearStart.setHours(0, 0, 0, 0);
  } else {
    last28DaysLastYearEnd = new Date(last28DaysEnd);
    last28DaysLastYearEnd.setFullYear(last28DaysLastYearEnd.getFullYear() - 1);
    last28DaysLastYearStart = new Date(last28DaysStart);
    last28DaysLastYearStart.setFullYear(last28DaysLastYearStart.getFullYear() - 1);
  }

  // Last 365 days
  const last365DaysEnd = new Date(now);
  const last365DaysStart = new Date(now);
  last365DaysStart.setDate(last365DaysStart.getDate() - 364);
  last365DaysStart.setHours(0, 0, 0, 0);

  // Year-over-Year for 365 days: use Saturday numbering
  const last365DaysSaturday = findSaturdayInRange(last365DaysStart, last365DaysEnd);
  const last365DaysYearAgoSaturday = last365DaysSaturday ? getSameSaturdayLastYear(last365DaysSaturday) : null;

  let last365DaysLastYearStart: Date;
  let last365DaysLastYearEnd: Date;

  if (last365DaysYearAgoSaturday) {
    last365DaysLastYearEnd = new Date(last365DaysYearAgoSaturday);
    last365DaysLastYearEnd.setHours(23, 59, 59, 999);
    last365DaysLastYearStart = new Date(last365DaysLastYearEnd);
    last365DaysLastYearStart.setDate(last365DaysLastYearStart.getDate() - 364);
    last365DaysLastYearStart.setHours(0, 0, 0, 0);
  } else {
    last365DaysLastYearEnd = new Date(last365DaysEnd);
    last365DaysLastYearEnd.setFullYear(last365DaysLastYearEnd.getFullYear() - 1);
    last365DaysLastYearStart = new Date(last365DaysStart);
    last365DaysLastYearStart.setFullYear(last365DaysLastYearStart.getFullYear() - 1);
  }

  // Calculate previous periods (same length, immediately before current period)
  const last7DaysPreviousEnd = new Date(last7DaysStart.getTime() - 1);
  last7DaysPreviousEnd.setHours(23, 59, 59, 999);
  const last7DaysPreviousStart = new Date(last7DaysPreviousEnd.getTime() - (7 * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000));
  last7DaysPreviousStart.setHours(0, 0, 0, 0);

  const last28DaysPreviousEnd = new Date(last28DaysStart.getTime() - 1);
  last28DaysPreviousEnd.setHours(23, 59, 59, 999);
  const last28DaysPreviousStart = new Date(last28DaysPreviousEnd.getTime() - (28 * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000));
  last28DaysPreviousStart.setHours(0, 0, 0, 0);

  const last365DaysPreviousEnd = new Date(last365DaysStart.getTime() - 1);
  last365DaysPreviousEnd.setHours(23, 59, 59, 999);
  const last365DaysPreviousStart = new Date(last365DaysPreviousEnd.getTime() - (365 * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000));
  last365DaysPreviousStart.setHours(0, 0, 0, 0);

  // Fetch all metrics in parallel
  const [
    last7DaysCurrent, last7DaysLastYear, last7DaysPrevious,
    last28DaysCurrent, last28DaysLastYear, last28DaysPrevious,
    last365DaysCurrent, last365DaysLastYear, last365DaysPrevious
  ] = await Promise.all([
    fetchPeriodMetrics(last7DaysStart, last7DaysEnd, venueFilter),
    fetchPeriodMetrics(last7DaysLastYearStart, last7DaysLastYearEnd, venueFilter),
    fetchPeriodMetrics(last7DaysPreviousStart, last7DaysPreviousEnd, venueFilter),
    fetchPeriodMetrics(last28DaysStart, last28DaysEnd, venueFilter),
    fetchPeriodMetrics(last28DaysLastYearStart, last28DaysLastYearEnd, venueFilter),
    fetchPeriodMetrics(last28DaysPreviousStart, last28DaysPreviousEnd, venueFilter),
    fetchPeriodMetrics(last365DaysStart, last365DaysEnd, venueFilter),
    fetchPeriodMetrics(last365DaysLastYearStart, last365DaysLastYearEnd, venueFilter),
    fetchPeriodMetrics(last365DaysPreviousStart, last365DaysPreviousEnd, venueFilter)
  ]);

  // Build core statistics
  coreStats.push({
    currentPeriod: last7DaysCurrent,
    lastYearPeriod: last7DaysLastYear,
    previousPeriod: last7DaysPrevious,
    totalVariance: calculateVariance(last7DaysCurrent.totalRevenue, last7DaysLastYear.totalRevenue),
    barVariance: calculateVariance(last7DaysCurrent.barRevenue, last7DaysLastYear.barRevenue),
    doorVariance: calculateVariance(last7DaysCurrent.doorRevenue, last7DaysLastYear.doorRevenue),
    previousPeriodVariance: calculateVariance(last7DaysCurrent.totalRevenue, last7DaysPrevious.totalRevenue),
    periodLabel: 'Last 7 Days',
    currentDateRange: { start: last7DaysStart, end: last7DaysEnd },
    lastYearDateRange: { start: last7DaysLastYearStart, end: last7DaysLastYearEnd },
    previousDateRange: { start: last7DaysPreviousStart, end: last7DaysPreviousEnd }
  });

  coreStats.push({
    currentPeriod: last28DaysCurrent,
    lastYearPeriod: last28DaysLastYear,
    previousPeriod: last28DaysPrevious,
    totalVariance: calculateVariance(last28DaysCurrent.totalRevenue, last28DaysLastYear.totalRevenue),
    barVariance: calculateVariance(last28DaysCurrent.barRevenue, last28DaysLastYear.barRevenue),
    doorVariance: calculateVariance(last28DaysCurrent.doorRevenue, last28DaysLastYear.doorRevenue),
    previousPeriodVariance: calculateVariance(last28DaysCurrent.totalRevenue, last28DaysPrevious.totalRevenue),
    periodLabel: 'Last 28 Days',
    currentDateRange: { start: last28DaysStart, end: last28DaysEnd },
    lastYearDateRange: { start: last28DaysLastYearStart, end: last28DaysLastYearEnd },
    previousDateRange: { start: last28DaysPreviousStart, end: last28DaysPreviousEnd }
  });

  coreStats.push({
    currentPeriod: last365DaysCurrent,
    lastYearPeriod: last365DaysLastYear,
    previousPeriod: last365DaysPrevious,
    totalVariance: calculateVariance(last365DaysCurrent.totalRevenue, last365DaysLastYear.totalRevenue),
    barVariance: calculateVariance(last365DaysCurrent.barRevenue, last365DaysLastYear.barRevenue),
    doorVariance: calculateVariance(last365DaysCurrent.doorRevenue, last365DaysLastYear.doorRevenue),
    previousPeriodVariance: calculateVariance(last365DaysCurrent.totalRevenue, last365DaysPrevious.totalRevenue),
    periodLabel: 'Last 365 Days',
    currentDateRange: { start: last365DaysStart, end: last365DaysEnd },
    lastYearDateRange: { start: last365DaysLastYearStart, end: last365DaysLastYearEnd },
    previousDateRange: { start: last365DaysPreviousStart, end: last365DaysPreviousEnd }
  });

  return coreStats;
}

// Custom date range metrics fetcher
interface CustomRangeData {
  currentPeriod: PeriodMetrics;
  lastWeekComparison: ComparisonMetrics;
  lastMonthComparison: ComparisonMetrics;
  lastYearComparison: ComparisonMetrics;
}

function getComparisonRanges(startDate: Date, endDate: Date) {
  // Ensure start is beginning of day, end is end of day
  const currentStart = new Date(startDate);
  currentStart.setHours(0, 0, 0, 0);
  const currentEnd = new Date(endDate);
  currentEnd.setHours(23, 59, 59, 999);

  // Calculate period length in milliseconds
  const periodLengthMs = currentEnd.getTime() - currentStart.getTime();
  
  // Previous period (same length, immediately before current period)
  const lastWeekEnd = new Date(currentStart.getTime() - 1);
  lastWeekEnd.setHours(23, 59, 59, 999);
  const lastWeekStart = new Date(lastWeekEnd.getTime() - periodLengthMs + (24 * 60 * 60 * 1000));
  lastWeekStart.setHours(0, 0, 0, 0);

  // Same period from previous month
  const lastMonthStart = new Date(currentStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  lastMonthStart.setHours(0, 0, 0, 0);
  const lastMonthEnd = new Date(lastMonthStart.getTime() + periodLengthMs);
  lastMonthEnd.setHours(23, 59, 59, 999);

  // Same period from previous year - use Saturday numbering for alignment
  const currentSaturday = findSaturdayInRange(currentStart, currentEnd);
  const yearAgoSaturday = currentSaturday ? getSameSaturdayLastYear(currentSaturday) : null;

  let lastYearStart: Date;
  let lastYearEnd: Date;

  if (yearAgoSaturday) {
    // Center the year-ago period around the corresponding Saturday
    lastYearEnd = new Date(yearAgoSaturday);
    lastYearEnd.setHours(23, 59, 59, 999);
    lastYearStart = new Date(lastYearEnd.getTime() - periodLengthMs + (24 * 60 * 60 * 1000));
    lastYearStart.setHours(0, 0, 0, 0);
  } else {
    // Fallback: calendar year subtraction
    lastYearStart = new Date(currentStart);
    lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
    lastYearStart.setHours(0, 0, 0, 0);
    lastYearEnd = new Date(lastYearStart.getTime() + periodLengthMs);
    lastYearEnd.setHours(23, 59, 59, 999);
  }

  return {
    current: { start: currentStart, end: currentEnd },
    lastWeek: { start: lastWeekStart, end: lastWeekEnd },
    lastMonth: { start: lastMonthStart, end: lastMonthEnd },
    lastYear: { start: lastYearStart, end: lastYearEnd }
  };
}

async function fetchCustomRangeData(
  startDate: Date, 
  endDate: Date, 
  venueFilter?: string | null
): Promise<CustomRangeData> {
  const ranges = getComparisonRanges(startDate, endDate);

  const [currentMetrics, lastWeekMetrics, lastMonthMetrics, lastYearMetrics] = await Promise.all([
    fetchPeriodMetrics(ranges.current.start, ranges.current.end, venueFilter),
    fetchPeriodMetrics(ranges.lastWeek.start, ranges.lastWeek.end, venueFilter),
    fetchPeriodMetrics(ranges.lastMonth.start, ranges.lastMonth.end, venueFilter),
    fetchPeriodMetrics(ranges.lastYear.start, ranges.lastYear.end, venueFilter)
  ]);

  return {
    currentPeriod: currentMetrics,
    lastWeekComparison: {
      totalVariance: calculateVariance(currentMetrics.totalRevenue, lastWeekMetrics.totalRevenue),
      barVariance: calculateVariance(currentMetrics.barRevenue, lastWeekMetrics.barRevenue),
      doorVariance: calculateVariance(currentMetrics.doorRevenue, lastWeekMetrics.doorRevenue)
    },
    lastMonthComparison: {
      totalVariance: calculateVariance(currentMetrics.totalRevenue, lastMonthMetrics.totalRevenue),
      barVariance: calculateVariance(currentMetrics.barRevenue, lastMonthMetrics.barRevenue),
      doorVariance: calculateVariance(currentMetrics.doorRevenue, lastMonthMetrics.doorRevenue)
    },
    lastYearComparison: {
      totalVariance: calculateVariance(currentMetrics.totalRevenue, lastYearMetrics.totalRevenue),
      barVariance: calculateVariance(currentMetrics.barRevenue, lastYearMetrics.barRevenue),
      doorVariance: calculateVariance(currentMetrics.doorRevenue, lastYearMetrics.doorRevenue)
    }
  };
}

export const useRevenueDashboard = () => {
  const queryClient = useQueryClient();
  
  // State for custom date range selection
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);

  // Query for core statistics - automatically fetches and caches
  const coreStatsQuery = useQuery({
    queryKey: ['revenue-core-statistics'],
    queryFn: () => fetchCoreStatisticsData(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Query for custom date range - only runs when customRange is set
  const customRangeQuery = useQuery({
    queryKey: ['revenue-custom-range', customRange?.start?.toISOString(), customRange?.end?.toISOString()],
    queryFn: () => {
      if (!customRange) throw new Error('No date range selected');
      return fetchCustomRangeData(customRange.start, customRange.end);
    },
    enabled: !!customRange,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Fetch metrics for a custom date range
  const fetchAllMetrics = useCallback(async (startDate: Date, endDate: Date, venueFilter?: string | null) => {
    if (!startDate || !endDate) {
      toast({ title: 'Error', description: 'Please select both start and end dates', variant: 'destructive' });
      return;
    }

    if (startDate > endDate) {
      toast({ title: 'Error', description: 'Start date must be before end date', variant: 'destructive' });
      return;
    }

    // Set the custom range to trigger the query
    setCustomRange({ start: startDate, end: endDate });

    // Prefetch the data for immediate availability
    try {
      await queryClient.fetchQuery({
        queryKey: ['revenue-custom-range', startDate.toISOString(), endDate.toISOString()],
        queryFn: () => fetchCustomRangeData(startDate, endDate, venueFilter),
        staleTime: 1000 * 60 * 5,
      });

      if (customRangeQuery.data?.currentPeriod.eventCount === 0) {
        toast({ title: 'Info', description: 'No revenue data found for the selected date range' });
      }
    } catch (_error) {
      toast({ title: 'Error', description: 'Failed to fetch revenue data. Please try again.', variant: 'destructive' });
    }
  }, [queryClient, customRangeQuery.data?.currentPeriod.eventCount]);

  // Refresh core statistics
  const fetchCoreStatistics = useCallback(async (venueFilter?: string | null) => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['revenue-core-statistics'] });
    } catch (_error) {
      toast({ title: 'Error', description: 'Failed to fetch core statistics. Please try again.', variant: 'destructive' });
    }
  }, [queryClient]);

  // Derive loading state
  const isLoading = coreStatsQuery.isLoading || customRangeQuery.isFetching;

  return {
    isLoading,
    currentPeriod: customRangeQuery.data?.currentPeriod ?? { 
      totalRevenue: 0, 
      barRevenue: 0, 
      doorRevenue: 0,
      eventCount: 0
    },
    lastWeekComparison: customRangeQuery.data?.lastWeekComparison ?? { 
      totalVariance: 0, 
      barVariance: 0, 
      doorVariance: 0 
    },
    lastMonthComparison: customRangeQuery.data?.lastMonthComparison ?? { 
      totalVariance: 0, 
      barVariance: 0, 
      doorVariance: 0 
    },
    lastYearComparison: customRangeQuery.data?.lastYearComparison ?? { 
      totalVariance: 0, 
      barVariance: 0, 
      doorVariance: 0 
    },
    coreStatistics: coreStatsQuery.data ?? [],
    fetchAllMetrics,
    fetchCoreStatistics
  };
};
