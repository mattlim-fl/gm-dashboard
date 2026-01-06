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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-80 w-full">
            <BarChart data={data}>
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
                tickFormatter={(value) => formatCurrency(value as number)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, _item, _index, payload) => {
                      const point = payload as PnlChartPoint;
                      const total =
                        (point.cogs || 0) +
                        (point.wages || 0) +
                        (point.security || 0) +
                        (point.other || 0);
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono">
                            {formatCurrency(value as number)}{" "}
                            <span className="ml-1 text-muted-foreground text-[0.7rem]">
                              {name}
                            </span>
                          </span>
                          <span className="text-[0.7rem] text-muted-foreground">
                            Total: {formatCurrency(total)}
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


