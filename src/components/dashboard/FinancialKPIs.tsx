
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DollarSign, TrendingUp, TrendingDown, Users, ShoppingBag, Shield, Calendar, UserCheck, Receipt } from "lucide-react";
import { FinancialKPIs as KPIs } from "@/services/financialService";
import { formatCurrency, formatPercent } from "@/utils/currencyUtils";

interface FinancialKPIsProps {
  kpis: KPIs | null;
  isLoading: boolean;
}

export function FinancialKPIs({ kpis, isLoading }: FinancialKPIsProps) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Format absolute change in percentage points for costs (always positive, arrow shows direction)
  const formatCostChange = (val: number) => 
    `${Math.abs(val).toFixed(1)}%`;

  const formatNumber = (val: number) => val.toLocaleString();

  const cards = [
    // Row 1: Profit / Revenue / Attendance / Spend per Head
    {
      title: "Net Profit",
      icon: TrendingUp,
      headline: formatPercent(kpis.netProfit.changePercent),
      subheader: formatCurrency(kpis.netProfit.total),
      changePercent: kpis.netProfit.changePercent,
      trend: kpis.netProfit.changePercent >= 0 ? "up" : "down",
      isCost: false,
      dollarAmount: kpis.netProfit.total,
      previousDollarAmount: kpis.netProfit.previousTotal,
      currentMargin: kpis.netProfit.marginPercent,
      previousMargin: kpis.netProfit.previousMarginPercent
    },
    {
      title: "Total Revenue",
      icon: DollarSign,
      headline: formatPercent(kpis.revenue.changePercent),
      subheader: formatCurrency(kpis.revenue.total),
      changePercent: kpis.revenue.changePercent,
      trend: kpis.revenue.changePercent >= 0 ? "up" : "down",
      isCost: false,
      dollarAmount: kpis.revenue.total,
      previousDollarAmount: kpis.revenue.previousTotal
    },
    {
      title: "Attendance",
      icon: UserCheck,
      headline: formatPercent(kpis.attendance.changePercent),
      subheader: formatNumber(kpis.attendance.total),
      changePercent: kpis.attendance.changePercent,
      trend: kpis.attendance.changePercent >= 0 ? "up" : "down",
      isCost: false,
      attendanceValue: kpis.attendance.total,
      previousAttendanceValue: kpis.attendance.previousTotal
    },
    {
      title: "Spend per Head",
      icon: Receipt,
      headline: formatPercent(kpis.spendPerHead.changePercent),
      subheader: formatCurrency(kpis.spendPerHead.total),
      changePercent: kpis.spendPerHead.changePercent,
      trend: kpis.spendPerHead.changePercent >= 0 ? "up" : "down",
      isCost: false,
      dollarAmount: kpis.spendPerHead.total,
      previousDollarAmount: kpis.spendPerHead.previousTotal
    },
    // Row 2: Bookings / Wages / COGS / Security
    {
      title: "Bookings",
      icon: Calendar,
      headline: formatPercent(kpis.bookings.changePercent),
      subheader: kpis.bookings.total.toLocaleString(),
      changePercent: kpis.bookings.changePercent,
      trend: kpis.bookings.changePercent >= 0 ? "up" : "down",
      isCost: false,
      breakdown: kpis.bookings.breakdown
    },
    {
      title: "Wages",
      icon: Users,
      headline: formatCostChange(kpis.wages.percentOfRevenue - kpis.wages.previousPercentOfRevenue),
      subheader: `${kpis.wages.percentOfRevenue.toFixed(1)}% of Revenue`,
      changePercent: kpis.wages.percentOfRevenue - kpis.wages.previousPercentOfRevenue,
      dollarAmount: kpis.wages.total,
      previousDollarAmount: kpis.wages.previousTotal,
      currentPercent: kpis.wages.percentOfRevenue,
      previousPercent: kpis.wages.previousPercentOfRevenue,
      // For costs: decrease (negative change) is good (green), increase (positive change) is bad (red)
      // Arrow shows actual direction of change
      trend: kpis.wages.percentOfRevenue - kpis.wages.previousPercentOfRevenue < 0 ? "down" : "up",
      isGood: kpis.wages.percentOfRevenue - kpis.wages.previousPercentOfRevenue <= 0, // Decrease is good
      isCost: true
    },
    {
      title: "COGS",
      icon: ShoppingBag,
      headline: formatCostChange(kpis.cogs.percentOfRevenue - kpis.cogs.previousPercentOfRevenue),
      subheader: `${kpis.cogs.percentOfRevenue.toFixed(1)}% of Revenue`,
      changePercent: kpis.cogs.percentOfRevenue - kpis.cogs.previousPercentOfRevenue,
      dollarAmount: kpis.cogs.total,
      previousDollarAmount: kpis.cogs.previousTotal,
      currentPercent: kpis.cogs.percentOfRevenue,
      previousPercent: kpis.cogs.previousPercentOfRevenue,
      trend: kpis.cogs.percentOfRevenue - kpis.cogs.previousPercentOfRevenue < 0 ? "down" : "up",
      isGood: kpis.cogs.percentOfRevenue - kpis.cogs.previousPercentOfRevenue <= 0,
      isCost: true
    },
    {
      title: "Security",
      icon: Shield,
      headline: formatCostChange(kpis.security.percentOfRevenue - kpis.security.previousPercentOfRevenue),
      subheader: `${kpis.security.percentOfRevenue.toFixed(1)}% of Revenue`,
      changePercent: kpis.security.percentOfRevenue - kpis.security.previousPercentOfRevenue,
      dollarAmount: kpis.security.total,
      previousDollarAmount: kpis.security.previousTotal,
      currentPercent: kpis.security.percentOfRevenue,
      previousPercent: kpis.security.previousPercentOfRevenue,
      trend: kpis.security.percentOfRevenue - kpis.security.previousPercentOfRevenue < 0 ? "down" : "up",
      isGood: kpis.security.percentOfRevenue - kpis.security.previousPercentOfRevenue <= 0,
      isCost: true
    }
  ];

  return (
    <div>
      <TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const cardContent = (
              <Card className={(card.dollarAmount !== undefined || card.breakdown || card.previousDollarAmount !== undefined || card.attendanceValue !== undefined) ? "cursor-help" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    {(() => {
                      // For cost cards, use isGood for color, trend for arrow direction
                      const colorClass = card.isCost 
                        ? (card.isGood ? "text-green-600" : "text-red-600")
                        : (card.trend === "up" ? "text-green-600" : "text-red-600");
                      const arrow = card.trend === "up" ? "↑" : "↓";
                      return (
                        <>
                          <span className={colorClass}>{arrow}</span>
                          <span className={colorClass}>{card.headline}</span>
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.subheader}
                  </p>
                </CardContent>
              </Card>
            );

            // Add tooltip for cards with dollar amounts, breakdown, attendance, or previous period data
            if (card.dollarAmount !== undefined || card.breakdown || card.previousDollarAmount !== undefined || card.attendanceValue !== undefined) {
              return (
                <Tooltip key={card.title}>
                  <TooltipTrigger asChild>
                    {cardContent}
                  </TooltipTrigger>
                  <TooltipContent>
                    {card.breakdown ? (
                      <div className="space-y-1">
                        <p className="font-medium mb-2">Booking Breakdown</p>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between gap-4">
                            <span>Tickets:</span>
                            <span className="font-medium">{card.breakdown.tickets}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Karaoke:</span>
                            <span className="font-medium">{card.breakdown.karaoke}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Venue Hire:</span>
                            <span className="font-medium">{card.breakdown.venueHire}</span>
                          </div>
                        </div>
                      </div>
                    ) : card.attendanceValue !== undefined ? (
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span>Last 28 Days:</span>
                          <span className="font-medium">{formatNumber(card.attendanceValue)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Previous Period:</span>
                          <span className="font-medium">{formatNumber(card.previousAttendanceValue!)}</span>
                        </div>
                      </div>
                    ) : card.previousDollarAmount !== undefined ? (
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span>Last 28 Days:</span>
                          <span className="font-medium">
                            {formatCurrency(card.dollarAmount!)}
                            {card.currentMargin !== undefined && (
                              <span className="text-muted-foreground ml-1">
                                ({card.currentMargin.toFixed(1)}%)
                              </span>
                            )}
                            {card.currentPercent !== undefined && (
                              <span className="text-muted-foreground ml-1">
                                ({card.currentPercent.toFixed(1)}% of rev)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Previous Period:</span>
                          <span className="font-medium">
                            {formatCurrency(card.previousDollarAmount)}
                            {card.previousMargin !== undefined && (
                              <span className="text-muted-foreground ml-1">
                                ({card.previousMargin.toFixed(1)}%)
                              </span>
                            )}
                            {card.previousPercent !== undefined && (
                              <span className="text-muted-foreground ml-1">
                                ({card.previousPercent.toFixed(1)}% of rev)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium">
                        {formatCurrency(card.dollarAmount!)}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={card.title}>{cardContent}</div>;
          })}
        </div>
      </TooltipProvider>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        These stats show the last 28 days
      </p>
    </div>
  );
}

