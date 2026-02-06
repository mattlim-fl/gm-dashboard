import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DollarSign, ArrowUp, ArrowDown, Minus, CalendarIcon, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRevenueDashboard } from '@/hooks/useRevenueDashboard';
import { useDateRanges } from '@/hooks/useDateRanges';

export const RevenueDashboard = () => {
  const {
    isLoading,
    currentPeriod,
    lastWeekComparison,
    lastMonthComparison,
    lastYearComparison,
    coreStatistics,
    fetchAllMetrics,
    fetchCoreStatistics
  } = useRevenueDashboard();

  const {
    selectedStartDate,
    selectedEndDate,
    setSelectedStartDate,
    setSelectedEndDate,
    quickRangeOptions,
    applyQuickRange,
    isValidDateRange
  } = useDateRanges();

  const handleUpdate = () => {
    if (selectedStartDate && selectedEndDate) {
      fetchAllMetrics(selectedStartDate, selectedEndDate);
    }
  };

  // Core statistics are now automatically fetched and cached by React Query

  const formatCurrency = (cents: number) => {
    // Convert cents to dollars (GST-inclusive / net sales)
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(dollars);
  };

  const formatPercentage = (value: number) => {
    if (currentPeriod.totalRevenue === 0) return 0;
    return Math.round((value / currentPeriod.totalRevenue) * 100);
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (variance < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-400';
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Revenue Dashboard</h1>
        <div className="grid gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Revenue Dashboard</h1>
      </div>

      {/* Core Statistics Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Core Statistics</h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchCoreStatistics()}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coreStatistics.length === 0 ? (
            // Loading state for core statistics
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            coreStatistics.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.periodLabel}</CardTitle>
                <div className="flex gap-1">
                  {getVarianceIcon(stat.totalVariance)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Current Period */}
                  <div>
                    <div className="text-2xl font-bold">{formatCurrency(stat.currentPeriod.totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground">
                      {stat.currentPeriod.eventCount} transactions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(stat.currentDateRange.start, "MMM d")} - {format(stat.currentDateRange.end, "MMM d, yyyy")}
                    </p>
                  </div>
                  
                  {/* Comparison Metrics */}
                  <div className="space-y-2">
                    {/* Year-over-Year */}
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-xs text-muted-foreground">vs same period last year</span>
                      <div className={`text-sm font-medium ${getVarianceColor(stat.totalVariance)}`}>
                        {stat.totalVariance > 0 ? '+' : ''}{stat.totalVariance.toFixed(1)}%
                      </div>
                    </div>
                    
                    {/* Period-over-Period */}
                    <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span className="text-xs text-muted-foreground">vs previous period</span>
                      <div className={`text-sm font-medium ${getVarianceColor(stat.previousPeriodVariance)}`}>
                        {stat.previousPeriodVariance > 0 ? '+' : ''}{stat.previousPeriodVariance.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            ))
          )}
        </div>
      </div>

      {/* Quick Range Buttons */}
      <div className="bg-card p-4 rounded-lg border">
        <h3 className="text-sm font-medium mb-3">Quick Date Ranges</h3>
        <div className="flex flex-wrap gap-2">
          {quickRangeOptions.map((option) => (
            <Button
              key={option.label}
              variant="outline"
              size="sm"
              onClick={() => applyQuickRange(option)}
              className="flex items-center gap-1"
            >
              <Zap className="h-3 w-3" />
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-card p-4 rounded-lg border">
        <h3 className="text-sm font-medium mb-3">Custom Date Range</h3>
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground mb-1">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !selectedStartDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedStartDate ? format(selectedStartDate, "MMM d, yyyy") : <span>Pick start date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedStartDate}
                  onSelect={setSelectedStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground mb-1">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !selectedEndDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedEndDate ? format(selectedEndDate, "MMM d, yyyy") : <span>Pick end date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedEndDate}
                  onSelect={setSelectedEndDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col">
            <div className="text-xs text-muted-foreground mb-1">&nbsp;</div>
            <Button 
              onClick={handleUpdate}
              disabled={!isValidDateRange() || isLoading}
            >
              {isLoading ? 'Loading...' : 'Update'}
            </Button>
          </div>
        </div>
      </div>

      {/* Current Period Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          Selected Period
          {selectedStartDate && selectedEndDate && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({format(selectedStartDate, "MMM d")} - {format(selectedEndDate, "MMM d, yyyy")})
            </span>
          )}
        </h2>
        
        {/* Total Revenue Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(currentPeriod.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                {currentPeriod.eventCount} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bar Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(currentPeriod.barRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                {formatPercentage(currentPeriod.barRevenue)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Door Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(currentPeriod.doorRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                {formatPercentage(currentPeriod.doorRevenue)}% of total
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comparison Sections */}
      <div className="space-y-6">
        {/* VS Last Week */}
        <div>
          <h2 className="text-xl font-semibold mb-4">VS Last Week</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                {getVarianceIcon(lastWeekComparison.totalVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastWeekComparison.totalVariance)}`}>
                  {lastWeekComparison.totalVariance > 0 ? '+' : ''}{lastWeekComparison.totalVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bar Revenue</CardTitle>
                {getVarianceIcon(lastWeekComparison.barVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastWeekComparison.barVariance)}`}>
                  {lastWeekComparison.barVariance > 0 ? '+' : ''}{lastWeekComparison.barVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Door Revenue</CardTitle>
                {getVarianceIcon(lastWeekComparison.doorVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastWeekComparison.doorVariance)}`}>
                  {lastWeekComparison.doorVariance > 0 ? '+' : ''}{lastWeekComparison.doorVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* VS Last Month */}
        <div>
          <h2 className="text-xl font-semibold mb-4">VS Last Month</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                {getVarianceIcon(lastMonthComparison.totalVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastMonthComparison.totalVariance)}`}>
                  {lastMonthComparison.totalVariance > 0 ? '+' : ''}{lastMonthComparison.totalVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bar Revenue</CardTitle>
                {getVarianceIcon(lastMonthComparison.barVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastMonthComparison.barVariance)}`}>
                  {lastMonthComparison.barVariance > 0 ? '+' : ''}{lastMonthComparison.barVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Door Revenue</CardTitle>
                {getVarianceIcon(lastMonthComparison.doorVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastMonthComparison.doorVariance)}`}>
                  {lastMonthComparison.doorVariance > 0 ? '+' : ''}{lastMonthComparison.doorVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* VS Last Year */}
        <div>
          <h2 className="text-xl font-semibold mb-4">VS Last Year</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                {getVarianceIcon(lastYearComparison.totalVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastYearComparison.totalVariance)}`}>
                  {lastYearComparison.totalVariance > 0 ? '+' : ''}{lastYearComparison.totalVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bar Revenue</CardTitle>
                {getVarianceIcon(lastYearComparison.barVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastYearComparison.barVariance)}`}>
                  {lastYearComparison.barVariance > 0 ? '+' : ''}{lastYearComparison.barVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Door Revenue</CardTitle>
                {getVarianceIcon(lastYearComparison.doorVariance)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getVarianceColor(lastYearComparison.doorVariance)}`}>
                  {lastYearComparison.doorVariance > 0 ? '+' : ''}{lastYearComparison.doorVariance.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};