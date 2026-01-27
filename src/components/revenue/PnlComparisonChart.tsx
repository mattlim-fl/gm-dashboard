import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type PnlChartPoint = {
  period: string;
  cogs: number;
  wages: number;
  security: number;
  other: number;
};

type PercentageChartPoint = {
  period: string;
  cogs: number;
  wages: number;
  security: number;
  other: number;
  _original: PnlChartPoint;
};

interface PnlComparisonChartProps {
  data: PnlChartPoint[];
  currentLabel: string;
  comparisonLabel: string;
}

const chartConfig = {
  cogs: {
    label: "Cost of Goods Sold",
    color: "hsl(var(--chart-1))",
  },
  wages: {
    label: "Wages",
    color: "hsl(var(--chart-2))",
  },
  security: {
    label: "Security",
    color: "hsl(var(--chart-3))",
  },
  other: {
    label: "Other Costs",
    color: "hsl(var(--chart-4))",
  },
};

import { formatCurrency } from "@/utils/currencyUtils";

export function PnlComparisonChart({
  data,
  currentLabel,
  comparisonLabel,
}: PnlComparisonChartProps) {
  const hasData = data && data.length > 0;

  // Transform data to percentages for 100% stacked bar chart
  const percentageData: PercentageChartPoint[] = hasData
    ? data.map((point) => {
        const total = point.cogs + point.wages + point.security + point.other;
        if (total === 0) {
          return {
            period: point.period,
            cogs: 0,
            wages: 0,
            security: 0,
            other: 0,
            _original: point,
          };
        }
        return {
          period: point.period,
          cogs: (point.cogs / total) * 100,
          wages: (point.wages / total) * 100,
          security: (point.security / total) * 100,
          other: (point.other / total) * 100,
          _original: point,
        };
      })
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown by Category</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-80 w-full">
            <BarChart data={percentageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, _item, _index, payload) => {
                      const point = payload as PercentageChartPoint;
                      const original = point._original;
                      const categoryKey = String(name).toLowerCase() as keyof typeof original;
                      const absoluteValue = original?.[categoryKey] ?? 0;
                      return (
                        <div className="flex items-center gap-2">
                          <span className="font-mono">
                            {(value as number).toFixed(1)}%
                          </span>
                          <span className="text-muted-foreground text-[0.7rem]">
                            ({formatCurrency(absoluteValue as number)})
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="cogs" stackId="a" fill="var(--color-cogs)" />
              <Bar dataKey="wages" stackId="a" fill="var(--color-wages)" />
              <Bar dataKey="security" stackId="a" fill="var(--color-security)" />
              <Bar dataKey="other" stackId="a" fill="var(--color-other)" />
              <ChartLegend
                verticalAlign="bottom"
                content={
                  <ChartLegendContent className="mt-4" />
                }
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="h-80 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                No P&amp;L data available for the selected period.
              </p>
              <p className="text-xs text-muted-foreground">
                Try choosing a different date range or refreshing from Xero.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Current: {currentLabel} • Comparison: {comparisonLabel}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


