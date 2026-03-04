import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { benchmarkService, CostBenchmarks } from '@/services/benchmarkService';
import { Loader2 } from 'lucide-react';

const COST_CATEGORIES = [
  { key: 'wages' as const, label: 'Wages', color: '#f87171' },
  { key: 'cogs' as const, label: 'COGS', color: '#fbbf24' },
  { key: 'security' as const, label: 'Security', color: '#a78bfa' },
];

export const BenchmarkSettings = () => {
  const [benchmarks, setBenchmarks] = useState<CostBenchmarks>({
    wages: 0,
    cogs: 0,
    security: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useQuery({
    queryKey: ['benchmarks'],
    queryFn: () => benchmarkService.getBenchmarks(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    select: (data) => {
      // Sync to local state for editing
      if (data && (benchmarks.wages === 0 && benchmarks.cogs === 0 && benchmarks.security === 0)) {
        setBenchmarks(data);
      }
      return data;
    },
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await benchmarkService.saveBenchmarks(benchmarks);
      toast({
        title: "Benchmarks saved",
        description: "Your cost benchmarks have been updated successfully.",
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save benchmark settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateBenchmark = (key: keyof CostBenchmarks, value: string) => {
    const numValue = parseFloat(value) || 0;
    setBenchmarks(prev => ({ ...prev, [key]: numValue }));
  };

  const totalBenchmark = benchmarks.wages + benchmarks.cogs + benchmarks.security;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cost Benchmarks</CardTitle>
          <CardDescription>
            Set target percentages for each cost category as a percentage of revenue. 
            These benchmarks will be displayed on the Cost as % of Revenue chart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {COST_CATEGORIES.map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: color }} 
                  />
                  <Label htmlFor={key} className="font-medium">
                    {label}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={key}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={benchmarks[key] || ''}
                    onChange={(e) => updateBenchmark(key, e.target.value)}
                    className="w-24 text-right"
                    placeholder="0"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="w-32">
                <span className="font-semibold">Total</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 text-right font-semibold text-lg">
                  {totalBenchmark.toFixed(1)}
                </span>
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              This is the combined target for all cost categories as a percentage of revenue.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Benchmarks'
          )}
        </Button>
      </div>
    </div>
  );
};








