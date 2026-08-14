"use client";

import { useCallback, useEffect, useState } from "react";
import { endOfWeek, startOfWeek } from "date-fns";

import { KpiCards } from "@/components/analytics/kpi-cards";
import { LayerDonuts } from "@/components/analytics/layer-donuts";
import { VarianceChart } from "@/components/analytics/variance-chart";
import { InsightAlerts } from "@/components/analytics/insight-alerts";
import { RangePicker } from "@/components/analytics/range-picker";
import { getAnalyticsSummary } from "@/app/actions/analytics";
import { WEEK_OPTIONS, type DateRange } from "@/lib/time-utils";
import type { AnalyticsSummary } from "@/types";

export function AnalyticsView() {
  const [range, setRange] = useState<DateRange>(() => ({
    start: startOfWeek(new Date(), WEEK_OPTIONS),
    end: endOfWeek(new Date(), WEEK_OPTIONS),
  }));
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rangeStartMs = range.start.getTime();
  const rangeEndMs = range.end.getTime();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAnalyticsSummary(
        new Date(rangeStartMs),
        new Date(rangeEndMs),
      );
      setSummary(data);
    } finally {
      setIsLoading(false);
    }
  }, [rangeStartMs, rangeEndMs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            How your actual time compares to what you planned.
          </p>
        </div>
        <RangePicker range={range} onChange={setRange} />
      </div>

      {isLoading || !summary ? (
        <div className="text-muted-foreground py-16 text-center text-sm">
          Loading…
        </div>
      ) : (
        <>
          <KpiCards summary={summary} />
          <LayerDonuts summary={summary} />
          <VarianceChart summary={summary} />
          <InsightAlerts insights={summary.insights} />
        </>
      )}
    </div>
  );
}
