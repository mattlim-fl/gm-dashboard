import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import { formatCurrency, formatPercent, getPercentColor } from "@/utils/currencyUtils";
import { TrendingDown } from "lucide-react";

interface RevenueMetricCardProps {
  title: string;
  metrics: {
    currentFormatted: string;
    currentAttendance?: number;
    currentSpendPerHeadFormatted?: string;
    changePercent: number;
    changePercentYear: number;
    attendanceChangePercent?: number;
    attendanceChangePercentYear?: number;
    spendPerHeadChangePercent?: number;
    spendPerHeadChangePercentYear?: number;
  };
  comparisonType: 'previous' | 'year';
  showRevenue?: boolean;
  showAttendance?: boolean;
  showSpendPerHead?: boolean;
}

export const RevenueMetricCard = ({
  title,
  metrics,
  comparisonType,
  showRevenue = true,
  showAttendance = false,
  showSpendPerHead = false,
}: RevenueMetricCardProps) => {
  const getTrendIcon = (percent: number) => {
    return percent >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  const revenueChangePercent = comparisonType === 'previous' 
    ? metrics.changePercent 
    : metrics.changePercentYear;
  
  const attendanceChangePercent = comparisonType === 'previous'
    ? (metrics.attendanceChangePercent ?? 0)
    : (metrics.attendanceChangePercentYear ?? 0);
  
  const spendPerHeadChangePercent = comparisonType === 'previous'
    ? (metrics.spendPerHeadChangePercent ?? 0)
    : (metrics.spendPerHeadChangePercentYear ?? 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Revenue */}
        {showRevenue && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <div className="text-xl font-bold">{metrics.currentFormatted}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {getTrendIcon(revenueChangePercent)}
              <span className={getPercentColor(revenueChangePercent)}>
                {formatPercent(revenueChangePercent)} {comparisonType === 'previous' ? 'vs previous' : 'vs last year'}
              </span>
            </div>
          </div>
        )}

        {/* Attendance */}
        {showAttendance && metrics.currentAttendance !== undefined && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Attendance</span>
            </div>
            <div className="text-xl font-bold">{metrics.currentAttendance.toLocaleString()}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {getTrendIcon(attendanceChangePercent)}
              <span className={getPercentColor(attendanceChangePercent)}>
                {formatPercent(attendanceChangePercent)} {comparisonType === 'previous' ? 'vs previous' : 'vs last year'}
              </span>
            </div>
          </div>
        )}

        {/* Spend per Head */}
        {showSpendPerHead && metrics.currentSpendPerHeadFormatted && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">$ per Head</span>
            </div>
            <div className="text-xl font-bold">{metrics.currentSpendPerHeadFormatted}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {getTrendIcon(spendPerHeadChangePercent)}
              <span className={getPercentColor(spendPerHeadChangePercent)}>
                {formatPercent(spendPerHeadChangePercent)} {comparisonType === 'previous' ? 'vs previous' : 'vs last year'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

