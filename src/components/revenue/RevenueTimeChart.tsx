import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, addWeeks, addMonths, addYears } from 'date-fns';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currencyUtils';

interface RevenueDataPoint {
  period: string;
  revenue: number;
  formattedRevenue: string;
  date: Date;
  bar: number;
  door: number;
  attendance: number;
}

type TimeScale = 'weekly' | 'monthly' | 'yearly';

const chartConfig = {
  revenue: {
    label: "Total Revenue",
    color: "hsl(var(--chart-1))",
  },
  bar: {
    label: "Bar Revenue",
    color: "hsl(var(--chart-1))",
  },
  door: {
    label: "Door Revenue", 
    color: "hsl(var(--chart-2))",
  },
  attendance: {
    label: "Attendance",
    color: "#3B82F6", // Blue color for attendance line
  },
};

export const RevenueTimeChart = () => {
  const [timeScale, setTimeScale] = useState<TimeScale>('weekly');
  const [data, setData] = useState<RevenueDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<string>('all');
  const [venues, setVenues] = useState<string[]>([]);

  useEffect(() => {
    fetchVenues();
  }, []);

  useEffect(() => {
    fetchRevenueData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally omit fetchRevenueData - function reference changes on every render
  }, [timeScale, selectedVenue]);

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('square_locations')
        .select('location_name')
        .eq('is_active', true)
        .order('location_name');

      if (error) {
        return;
      }

      const locationNames = data?.map(row => row.location_name) || [];
      setVenues(locationNames);
    } catch (_error) {
      // Silent fail for venue fetch
    }
  };



  const fetchRevenueData = async () => {
    try {
      setIsLoading(true);
      
      let revenueData: RevenueDataPoint[] = [];
      const venueFilter = selectedVenue === 'all' ? null : selectedVenue;

      switch (timeScale) {
        case 'weekly':
          revenueData = await fetchWeeklyRevenue(venueFilter);
          break;
        case 'monthly':
          revenueData = await fetchMonthlyRevenue(venueFilter);
          break;
        case 'yearly':
          revenueData = await fetchYearlyRevenue(venueFilter);
          break;
      }

      setData(revenueData);
    } catch (_error) {
      // Silent fail for revenue data fetch
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWeeklyRevenue = async (venueFilter: string | null): Promise<RevenueDataPoint[]> => {
    // Generate the last 12 weeks manually to ensure consistent week boundaries
    const now = new Date();
    const weeks = [];
    
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7 - (i * 7)); // Monday start
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      weeks.push({ weekStart, weekEnd });
    }
    
    // Fetch revenue and attendance for each week using simple SQL functions
    const weekDataPromises = weeks.map(async (week) => {
      const [revenueResult, barRevenueResult, doorRevenueResult, attendanceResult] = await Promise.all([
        supabase.rpc('get_revenue_sum' as any, {
          start_date: week.weekStart.toISOString(),
          end_date: week.weekEnd.toISOString(),
          venue_filter: venueFilter
        }),
        supabase.rpc('get_bar_revenue_sum' as any, {
          start_date: week.weekStart.toISOString(),
          end_date: week.weekEnd.toISOString(),
          venue_filter: venueFilter
        }),
        supabase.rpc('get_door_revenue_sum' as any, {
          start_date: week.weekStart.toISOString(),
          end_date: week.weekEnd.toISOString(),
          venue_filter: venueFilter
        }),
        supabase.rpc('get_attendance_sum' as any, {
          start_date: week.weekStart.toISOString(),
          end_date: week.weekEnd.toISOString(),
          venue_filter: venueFilter
        })
      ]);

      const revenue = (revenueResult.data as number) || 0;
      const barRevenue = (barRevenueResult.data as number) || 0;
      const doorRevenue = (doorRevenueResult.data as number) || 0;
      const attendance = (attendanceResult.data as number) || 0;

      return {
        period: format(week.weekStart, 'MMM dd'),
        revenue,
        formattedRevenue: formatCurrencyUtil(revenue, { inputInCents: true, excludeGST: true }),
        date: week.weekStart,
        bar: barRevenue,
        door: doorRevenue,
        attendance
      };
    });

    const weekData = await Promise.all(weekDataPromises);
    
    // Filter out the last week if it has no data (revenue = 0 and attendance = 0)
    const filteredWeekData = weekData.filter((week, index) => {
      // If it's the last week (index 0 after reverse) and has no data, exclude it
      if (index === 0 && week.revenue === 0 && week.attendance === 0) {
        return false;
      }
      return true;
    });
    
    return filteredWeekData.reverse(); // Reverse to show oldest to newest
  };

  const fetchMonthlyRevenue = async (venueFilter: string | null): Promise<RevenueDataPoint[]> => {
    // Fetch revenue data
    const { data: revenueData, error: revenueError } = await supabase.rpc('get_monthly_revenue_summary', {
      venue_filter: venueFilter,
      month_date: null
    });

    if (revenueError) {
      return [];
    }

    const months = (revenueData || []) as Array<{ month: string }>;
    if (!months.length) return [];

    // Take the last 12 months
    const monthlyData = months.slice(0, 12);
    
    // Fetch attendance for each month using the simple SQL function
    const attendancePromises = monthlyData.map(async (row) => {
      const monthStart = new Date(row.month);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const { data: attendance, error: attendanceError } = await supabase.rpc('get_attendance_sum' as any, {
        start_date: monthStart.toISOString(),
        end_date: monthEnd.toISOString(),
        venue_filter: venueFilter
      });

      if (attendanceError) {
        return 0;
      }

      return (attendance as number) || 0;
    });

    const attendanceData = await Promise.all(attendancePromises);
    
    return monthlyData.map((row, index) => {
      const monthStart = new Date(row.month);
      return {
        period: format(monthStart, 'MMM yyyy'),
        revenue: (row as any).total_revenue_cents,
        formattedRevenue: formatCurrencyUtil((row as any).total_revenue_cents, { inputInCents: true, excludeGST: true }),
        date: monthStart,
        bar: (row as any).bar_revenue_cents,
        door: (row as any).door_revenue_cents,
        attendance: attendanceData[index] || 0
      };
    }).reverse(); // Reverse to show oldest to newest
  };

  const fetchYearlyRevenue = async (venueFilter: string | null): Promise<RevenueDataPoint[]> => {
    // Fetch revenue data
    const { data: revenueData, error: revenueError } = await supabase.rpc('get_yearly_revenue_summary', {
      venue_filter: venueFilter,
      year_date: null
    });

    if (revenueError) {
      return [];
    }

    const years = (revenueData || []) as Array<{ year_start: string }>;
    if (!years.length) return [];

    // Take the last 5 years
    const yearlyData = years.slice(0, 5);
    
    // Fetch attendance for each year using the simple SQL function
    const attendancePromises = yearlyData.map(async (row) => {
      const yearStart = new Date(row.year_start);
      const yearEnd = new Date(yearStart);
      yearEnd.setFullYear(yearEnd.getFullYear() + 1);
      
      const { data: attendance, error: attendanceError } = await supabase.rpc('get_attendance_sum' as any, {
        start_date: yearStart.toISOString(),
        end_date: yearEnd.toISOString(),
        venue_filter: venueFilter
      });

      if (attendanceError) {
        return 0;
      }

      return (attendance as number) || 0;
    });

    const attendanceData = await Promise.all(attendancePromises);
    
    return yearlyData.map((row, index) => {
      const yearStart = new Date(row.year_start);
      return {
        period: format(yearStart, 'yyyy'),
        revenue: (row as any).total_revenue_cents,
        formattedRevenue: formatCurrencyUtil((row as any).total_revenue_cents, { inputInCents: true, excludeGST: true }),
        date: yearStart,
        bar: (row as any).bar_revenue_cents,
        door: (row as any).door_revenue_cents,
        attendance: attendanceData[index] || 0
      };
    }).reverse(); // Reverse to show oldest to newest
  };

  const formatCurrency = (value: number): string => {
    return formatCurrencyUtil(value, { inputInCents: true, excludeGST: true });
  };

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value);
  };

  const formatTooltipLabel = (label: string) => {
    return label;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading revenue data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Revenue Chart</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Venue:</span>
              <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues.map(venue => (
                    <SelectItem key={venue} value={venue}>{venue}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={timeScale} onValueChange={(value) => setTimeScale(value as TimeScale)}>
              <TabsList>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-96 w-full">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="revenue"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  const dollars = (value / 100) / 1.1;
                  const rounded = Math.round(dollars / 1000) * 1000;
                  return `$${rounded.toLocaleString()}`;
                }}
              />
              <YAxis 
                yAxisId="attendance"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const revenueItems = payload.filter(item => item.name === 'bar' || item.name === 'door');
                    const attendanceItem = payload.find(item => item.name === 'attendance');
                    const totalRevenue = revenueItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
                    
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{formatTooltipLabel(label)}</div>
                            <div className="text-sm font-bold">${(totalRevenue / 100).toLocaleString()}</div>
                          </div>
                          <div className="grid gap-1">
                            {revenueItems.map((item, index) => (
                              <div key={index} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <div 
                                    className="h-2 w-2 rounded-full" 
                                    style={{ backgroundColor: item.color }}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {item.name === 'bar' ? 'Bar' : 'Door'}
                                  </span>
                                </div>
                                <span className="text-xs font-medium">${((Number(item.value) || 0) / 100).toLocaleString()}</span>
                              </div>
                            ))}
                            {attendanceItem && (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <div 
                                    className="h-2 w-2 rounded-full" 
                                    style={{ backgroundColor: attendanceItem.color }}
                                  />
                                  <span className="text-xs text-muted-foreground">Attendance</span>
                                </div>
                                <span className="text-xs font-medium">{(attendanceItem.value || 0).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                yAxisId="revenue"
                dataKey="bar"
                stackId="a"
                fill="hsl(var(--chart-1))"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="revenue"
                dataKey="door"
                stackId="a"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 4, 4]}
              />
              <Line
                yAxisId="attendance"
                type="monotone"
                dataKey="attendance"
                stroke="#3B82F6"
                strokeWidth={3}
                dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#3B82F6" }}
              />
              <ChartLegend
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  return (
                    <ChartLegendContent
                      payload={payload}
                      className="mt-4"
                    />
                  );
                }}
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <p className="text-gray-500">No revenue data available</p>
              <p className="text-sm text-gray-400">Try syncing and transforming some payment data</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 