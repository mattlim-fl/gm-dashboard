import React from 'react';
import {
  useQueries,
  type UseQueryResult,
} from '@tanstack/react-query';
import { fetchPnl, type PnlResponse } from '@/services/xeroService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PnlComparisonChart } from '@/components/revenue/PnlComparisonChart';
import { TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatPercent } from '@/utils/currencyUtils';

type ComparisonType = 'previous' | 'year';

const CATEGORY_CONFIG = [
  { key: 'cogs', label: 'Cost of Goods Sold' },
  { key: 'wages', label: 'Wages' },
  { key: 'security', label: 'Security' },
] as const;

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPeriodDates(daysBack: number) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  return {
    start: toYmd(startDate),
    end: toYmd(endDate),
  };
}

function getComparisonPeriods(daysBack: number, comparisonType: ComparisonType) {
  const current = getPeriodDates(daysBack);
  const currentStartDate = new Date(current.start);
  const currentEndDate = new Date(current.end);
  
  if (comparisonType === 'previous') {
    // Previous period: same length before current period
    const previousEnd = new Date(currentStartDate);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousEnd.setHours(23, 59, 59, 999);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - daysBack + 1);
    previousStart.setHours(0, 0, 0, 0);

    return {
      current,
      comparison: {
        start: toYmd(previousStart),
        end: toYmd(previousEnd),
      },
    };
  } else {
    // Same period last year
    const yearStart = new Date(currentStartDate);
    yearStart.setFullYear(yearStart.getFullYear() - 1);
    const yearEnd = new Date(currentEndDate);
    yearEnd.setFullYear(yearEnd.getFullYear() - 1);

    // Ensure the range doesn't exceed 364 days (Xero API limit is 365 days,
    // and leap years can cause year-over-year ranges to span 366 days)
    const diffInDays = Math.round((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays > 364) {
      yearEnd.setTime(yearStart.getTime() + 364 * 24 * 60 * 60 * 1000);
    }

    return {
      current,
      comparison: {
        start: toYmd(yearStart),
        end: toYmd(yearEnd),
      },
    };
  }
}


function getTrendIcon(percent: number) {
  return percent >= 0 ? (
    <TrendingUp className="h-4 w-4 text-green-600" />
  ) : (
    <TrendingDown className="h-4 w-4 text-red-600" />
  );
}

function getTrendColor(percent: number) {
  return percent >= 0 ? 'text-green-600' : 'text-red-600';
}

interface PeriodData {
  current: PnlResponse | undefined;
  comparison: PnlResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

function calculateChangePercent(current: number, comparison: number): number {
  if (comparison === 0) return 0;
  return ((current - comparison) / Math.abs(comparison)) * 100;
}

export default function ProfitAndLoss() {
  const [comparisonType, setComparisonType] = React.useState<ComparisonType>('previous');

  // Fixed periods: 7, 28, 365 days
  const periods = React.useMemo(() => {
    return {
      weekly: getComparisonPeriods(7, comparisonType),
      monthly: getComparisonPeriods(28, comparisonType),
      yearly: getComparisonPeriods(365, comparisonType),
    };
  }, [comparisonType]);

  // Fetch data for all three periods
  // P&L data is expensive to fetch from Xero API, cache for 10 minutes
  const PNL_STALE_TIME = 1000 * 60 * 10; // 10 minutes

  const weeklyQueries = useQueries({
    queries: [
      {
        queryKey: ['pnl', 'weekly', 'current', periods.weekly.current.start, periods.weekly.current.end],
        queryFn: () => fetchPnl(periods.weekly.current.start, periods.weekly.current.end),
        staleTime: PNL_STALE_TIME,
      },
      {
        queryKey: ['pnl', 'weekly', 'comparison', periods.weekly.comparison.start, periods.weekly.comparison.end],
        queryFn: () => fetchPnl(periods.weekly.comparison.start, periods.weekly.comparison.end),
        staleTime: PNL_STALE_TIME,
      },
    ],
  }) as [UseQueryResult<PnlResponse, Error>, UseQueryResult<PnlResponse, Error>];

  const monthlyQueries = useQueries({
    queries: [
      {
        queryKey: ['pnl', 'monthly', 'current', periods.monthly.current.start, periods.monthly.current.end],
        queryFn: () => fetchPnl(periods.monthly.current.start, periods.monthly.current.end),
        staleTime: PNL_STALE_TIME,
      },
      {
        queryKey: ['pnl', 'monthly', 'comparison', periods.monthly.comparison.start, periods.monthly.comparison.end],
        queryFn: () => fetchPnl(periods.monthly.comparison.start, periods.monthly.comparison.end),
        staleTime: PNL_STALE_TIME,
      },
    ],
  }) as [UseQueryResult<PnlResponse, Error>, UseQueryResult<PnlResponse, Error>];

  const yearlyQueries = useQueries({
    queries: [
      {
        queryKey: ['pnl', 'yearly', 'current', periods.yearly.current.start, periods.yearly.current.end],
        queryFn: () => fetchPnl(periods.yearly.current.start, periods.yearly.current.end),
        staleTime: PNL_STALE_TIME,
      },
      {
        queryKey: ['pnl', 'yearly', 'comparison', periods.yearly.comparison.start, periods.yearly.comparison.end],
        queryFn: () => fetchPnl(periods.yearly.comparison.start, periods.yearly.comparison.end),
        staleTime: PNL_STALE_TIME,
      },
    ],
  }) as [UseQueryResult<PnlResponse, Error>, UseQueryResult<PnlResponse, Error>];

  const weeklyData: PeriodData = {
    current: weeklyQueries[0].data,
    comparison: weeklyQueries[1].data,
    isLoading: weeklyQueries[0].isLoading || weeklyQueries[1].isLoading,
    isError: weeklyQueries[0].isError || weeklyQueries[1].isError,
    error: weeklyQueries[0].error || weeklyQueries[1].error || null,
  };

  const monthlyData: PeriodData = {
    current: monthlyQueries[0].data,
    comparison: monthlyQueries[1].data,
    isLoading: monthlyQueries[0].isLoading || monthlyQueries[1].isLoading,
    isError: monthlyQueries[0].isError || monthlyQueries[1].isError,
    error: monthlyQueries[0].error || monthlyQueries[1].error || null,
  };

  const yearlyData: PeriodData = {
    current: yearlyQueries[0].data,
    comparison: yearlyQueries[1].data,
    isLoading: yearlyQueries[0].isLoading || yearlyQueries[1].isLoading,
    isError: yearlyQueries[0].isError || yearlyQueries[1].isError,
    error: yearlyQueries[0].error || yearlyQueries[1].error || null,
  };

  const isLoading = weeklyData.isLoading || monthlyData.isLoading || yearlyData.isLoading;
  const isError = weeklyData.isError || monthlyData.isError || yearlyData.isError;
  const error = weeklyData.error || monthlyData.error || yearlyData.error;

  // Helper to render a metric within a card
  const renderMetric = (
    icon: React.ReactNode,
    label: string,
    value: number,
    comparisonValue: number | undefined,
    periodData: PeriodData
  ) => {
    const changePercent = comparisonValue !== undefined
      ? calculateChangePercent(value, comparisonValue)
      : 0;

    return (
      <div>
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-xl font-bold">{formatCurrency(value)}</div>
        {periodData.comparison && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            {getTrendIcon(changePercent)}
            <span className={getTrendColor(changePercent)}>
              {formatPercent(changePercent)} {comparisonType === 'previous' ? 'vs previous' : 'vs last year'}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Helper to render cost breakdown for a period
  const renderCostBreakdown = (periodData: PeriodData) => {
    if (!periodData.current) return null;

    const currentCats = periodData.current.categories || {};
    const comparisonCats = periodData.comparison?.categories || {};

    const cogsCurrent = currentCats.cogs || 0;
    const wagesCurrent = currentCats.wages || 0;
    const securityCurrent = currentCats.security || 0;

    const cogsComparison = comparisonCats.cogs || 0;
    const wagesComparison = comparisonCats.wages || 0;
    const securityComparison = comparisonCats.security || 0;

    const knownCurrentTotal = cogsCurrent + wagesCurrent + securityCurrent;
    const knownComparisonTotal = cogsComparison + wagesComparison + securityComparison;

    const otherCurrent = Math.max(0, (periodData.current.totals.expenses || 0) - knownCurrentTotal);
    const otherComparison = periodData.comparison
      ? Math.max(0, (periodData.comparison.totals.expenses || 0) - knownComparisonTotal)
      : 0;

    // Get uncategorized items for tooltip
    const uncategorizedItems = periodData.current.uncategorized || [];
    // Group by name and sum amounts
    const groupedItems = uncategorizedItems.reduce((acc, item) => {
      const name = item.name || 'Unnamed';
      acc[name] = (acc[name] || 0) + Math.abs(item.amount);
      return acc;
    }, {} as Record<string, number>);
    // Sort by amount descending
    const sortedItems = Object.entries(groupedItems)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 items

    const items: Array<{
      key: string;
      label: string;
      current: number;
      comparison: number;
      uncategorized?: Array<{ name: string; amount: number }>;
    }> = [
      { key: 'cogs', label: 'Cost of Goods Sold', current: cogsCurrent, comparison: cogsComparison },
      { key: 'wages', label: 'Wages', current: wagesCurrent, comparison: wagesComparison },
      { key: 'security', label: 'Security', current: securityCurrent, comparison: securityComparison },
    ];

    if (otherCurrent > 0) {
      items.push({
        key: 'other',
        label: 'Other Costs',
        current: otherCurrent,
        comparison: otherComparison,
        uncategorized: sortedItems,
      });
    }

    return (
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TooltipProvider>
            {items.map(({ key, label, current, comparison, uncategorized }) => {
              const changePercent = calculateChangePercent(current, comparison);

              const content = (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatCurrency(current)}</div>
                    {periodData.comparison && (
                      <div className="flex items-center justify-end space-x-1 text-xs text-muted-foreground">
                        {getTrendIcon(changePercent)}
                        <span className={getTrendColor(changePercent)}>
                          {formatPercent(changePercent)} {comparisonType === 'previous' ? 'vs previous' : 'vs last year'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );

              // If this is "Other Costs" and we have uncategorized items, wrap in tooltip
              if (key === 'other' && uncategorized && uncategorized.length > 0) {
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">{content}</div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-md">
                      <div className="space-y-2">
                        <div className="font-semibold text-sm mb-2">Other Costs Breakdown</div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {uncategorized.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground truncate pr-2">{item.name}</span>
                              <span className="font-medium whitespace-nowrap">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {uncategorizedItems.length > 10 && (
                          <div className="text-xs text-muted-foreground pt-1 border-t">
                            Showing top 10 of {uncategorizedItems.length} items
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={key}>{content}</div>;
            })}
          </TooltipProvider>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gm-neutral-900 dark:text-white">Profit &amp; Loss</h1>
          <p className="text-gm-neutral-600 dark:text-gm-neutral-400">Track your profit and loss performance across different time periods.</p>
        </div>

        {/* Comparison Type Toggle */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gm-neutral-600 dark:text-gm-neutral-300">Compare to:</span>
          <div className="flex bg-gm-neutral-100 dark:bg-gm-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setComparisonType('previous')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                comparisonType === 'previous'
                  ? 'bg-white dark:bg-gm-neutral-700 text-gm-neutral-900 dark:text-white shadow-sm'
                  : 'text-gm-neutral-600 dark:text-gm-neutral-400 hover:text-gm-neutral-900 dark:hover:text-white'
              }`}
            >
              Previous Period
            </button>
            <button
              onClick={() => setComparisonType('year')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                comparisonType === 'year'
                  ? 'bg-white dark:bg-gm-neutral-700 text-gm-neutral-900 dark:text-white shadow-sm'
                  : 'text-gm-neutral-600 dark:text-gm-neutral-400 hover:text-gm-neutral-900 dark:hover:text-white'
              }`}
            >
              Same Period Last Year
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && error && (
          <div className="text-red-600">
            {error.message}
          </div>
        )}

        {/* Metrics Summary Cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Last 7 Days Column */}
            <div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {weeklyData.current && (
                    <>
                      {renderMetric(
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />,
                        'Total Income',
                        weeklyData.current.totals.income,
                        weeklyData.comparison?.totals.income,
                        weeklyData
                      )}
                      {renderMetric(
                        <TrendingDown className="h-3 w-3 text-muted-foreground" />,
                        'Total Expenses',
                        weeklyData.current.totals.expenses,
                        weeklyData.comparison?.totals.expenses,
                        weeklyData
                      )}
                      {renderMetric(
                        <DollarSign className="h-3 w-3 text-muted-foreground" />,
                        'Net Profit',
                        weeklyData.current.totals.netProfit,
                        weeklyData.comparison?.totals.netProfit,
                        weeklyData
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
              {renderCostBreakdown(weeklyData)}
            </div>

            {/* Last 28 Days Column */}
            <div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last 28 Days</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {monthlyData.current && (
                    <>
                      {renderMetric(
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />,
                        'Total Income',
                        monthlyData.current.totals.income,
                        monthlyData.comparison?.totals.income,
                        monthlyData
                      )}
                      {renderMetric(
                        <TrendingDown className="h-3 w-3 text-muted-foreground" />,
                        'Total Expenses',
                        monthlyData.current.totals.expenses,
                        monthlyData.comparison?.totals.expenses,
                        monthlyData
                      )}
                      {renderMetric(
                        <DollarSign className="h-3 w-3 text-muted-foreground" />,
                        'Net Profit',
                        monthlyData.current.totals.netProfit,
                        monthlyData.comparison?.totals.netProfit,
                        monthlyData
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
              {renderCostBreakdown(monthlyData)}
            </div>

            {/* Last 365 Days Column */}
            <div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last 365 Days</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {yearlyData.current && (
                    <>
                      {renderMetric(
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />,
                        'Total Income',
                        yearlyData.current.totals.income,
                        yearlyData.comparison?.totals.income,
                        yearlyData
                      )}
                      {renderMetric(
                        <TrendingDown className="h-3 w-3 text-muted-foreground" />,
                        'Total Expenses',
                        yearlyData.current.totals.expenses,
                        yearlyData.comparison?.totals.expenses,
                        yearlyData
                      )}
                      {renderMetric(
                        <DollarSign className="h-3 w-3 text-muted-foreground" />,
                        'Net Profit',
                        yearlyData.current.totals.netProfit,
                        yearlyData.comparison?.totals.netProfit,
                        yearlyData
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
              {renderCostBreakdown(yearlyData)}
            </div>
          </div>
        )}


        {/* Cost chart - Weekly / Monthly / Yearly splits */}
        {!isLoading && (weeklyData.current || monthlyData.current || yearlyData.current) && (
          <PnlComparisonChart
            data={(
              [
                weeklyData.current && {
                  period: 'Last 7 Days',
                  cogs: weeklyData.current.categories.cogs || 0,
                  wages: weeklyData.current.categories.wages || 0,
                  security: weeklyData.current.categories.security || 0,
                  other:
                    (weeklyData.current.totals.expenses || 0) -
                    ((weeklyData.current.categories.cogs || 0) +
                      (weeklyData.current.categories.wages || 0) +
                      (weeklyData.current.categories.security || 0)),
                },
                monthlyData.current && {
                  period: 'Last 28 Days',
                  cogs: monthlyData.current.categories.cogs || 0,
                  wages: monthlyData.current.categories.wages || 0,
                  security: monthlyData.current.categories.security || 0,
                  other:
                    (monthlyData.current.totals.expenses || 0) -
                    ((monthlyData.current.categories.cogs || 0) +
                      (monthlyData.current.categories.wages || 0) +
                      (monthlyData.current.categories.security || 0)),
                },
                yearlyData.current && {
                  period: 'Last 365 Days',
                  cogs: yearlyData.current.categories.cogs || 0,
                  wages: yearlyData.current.categories.wages || 0,
                  security: yearlyData.current.categories.security || 0,
                  other:
                    (yearlyData.current.totals.expenses || 0) -
                    ((yearlyData.current.categories.cogs || 0) +
                      (yearlyData.current.categories.wages || 0) +
                      (yearlyData.current.categories.security || 0)),
                },
              ].filter(Boolean) as any
            )}
            currentLabel="Last 7 / 28 / 365 days"
            comparisonLabel=""
          />
        )}
      </div>
    </DashboardLayout>
  );
}