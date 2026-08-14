"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatHours } from "@/lib/time-utils";
import {
  CHART_AXIS_INK,
  CHART_GRID,
  VARIANCE_OVER,
  VARIANCE_UNDER,
} from "@/lib/chart-colors";
import type { AnalyticsSummary } from "@/types";

/**
 * Over/under-plan is polarity, not identity: the same category can land on
 * either side depending on the week, so this deliberately does not reuse the
 * category's own color (which would repaint on every filter change — the
 * "color follows the entity, never its rank" rule cuts the other way here,
 * since the entity being encoded is the variance's sign, not the category).
 */
export function VarianceChart({ summary }: { summary: AnalyticsSummary }) {
  const data = summary.breakdown
    .filter((entry) => entry.plannedMinutes > 0 || entry.actualMinutes > 0)
    .map((entry) => ({
      name: entry.categoryName,
      varianceHours: entry.varianceMinutes / 60,
    }))
    .sort((a, b) => b.varianceHours - a.varianceHours);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Variance by category</h3>
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: VARIANCE_OVER }}
            />
            Over plan
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: VARIANCE_UNDER }}
            />
            Under plan
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
          No events in this range
        </div>
      ) : (
        <div style={{ height: Math.max(160, data.length * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={CHART_GRID} />
              <XAxis
                type="number"
                tickFormatter={(value) => formatHours(value * 60)}
                stroke={CHART_AXIS_INK}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                stroke={CHART_AXIS_INK}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine x={0} stroke={CHART_AXIS_INK} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                formatter={(value) => {
                  const hours = Number(value);
                  return [
                    `${hours >= 0 ? "+" : ""}${formatHours(hours * 60)}`,
                    hours >= 0 ? "Over plan" : "Under plan",
                  ];
                }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="varianceHours" radius={4} maxBarSize={22}>
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.varianceHours >= 0 ? VARIANCE_OVER : VARIANCE_UNDER}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
