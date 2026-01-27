import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { RevenueTimeChart } from "@/components/revenue/RevenueTimeChart";
import { RevenueMetricCard } from "@/components/revenue/RevenueMetricCard";
import { ComparisonTypeToggle } from "@/components/revenue/ComparisonTypeToggle";
import { useRevenueMetrics } from "@/hooks/useRevenueMetrics";

export default function Revenue() {
  const { dashboardData, isLoading } = useRevenueMetrics();
  const [comparisonType, setComparisonType] = useState<'previous' | 'year'>('previous');

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gm-neutral-900">Revenue Dashboard</h1>
            <p className="text-gm-neutral-600">Track your revenue performance across different time periods.</p>
          </div>
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
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gm-neutral-900 dark:text-white">Revenue Dashboard</h1>
          <p className="text-gm-neutral-600 dark:text-gm-neutral-400">Track your revenue performance across different time periods.</p>
        </div>

        {/* Comparison Type Toggle */}
        <ComparisonTypeToggle comparisonType={comparisonType} onChange={setComparisonType} />

        {/* Metrics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dashboardData?.weekly && (
            <RevenueMetricCard
              title="Last 7 Days"
              metrics={dashboardData.weekly}
              comparisonType={comparisonType}
              showRevenue
              showAttendance
              showSpendPerHead
            />
          )}
          {dashboardData?.monthly && (
            <RevenueMetricCard
              title="Last 28 Days"
              metrics={dashboardData.monthly}
              comparisonType={comparisonType}
              showRevenue
              showAttendance
              showSpendPerHead
            />
          )}
          {dashboardData?.yearly && (
            <RevenueMetricCard
              title="Last 365 Days"
              metrics={dashboardData.yearly}
              comparisonType={comparisonType}
              showRevenue
              showAttendance
              showSpendPerHead
            />
          )}
        </div>

        {/* Revenue Chart */}
        <div className="col-span-full">
          <RevenueTimeChart />
        </div>
      </div>
    </DashboardLayout>
  );
}
