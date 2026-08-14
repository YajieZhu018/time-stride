"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/time-utils";
import { foldTail } from "@/lib/chart-colors";
import type { AnalyticsSummary } from "@/types";

function Donut({
  title,
  total,
  slices,
}: {
  title: string;
  total: number;
  slices: { name: string; value: number; color: string }[];
}) {
  const data = foldTail(slices);

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-muted-foreground text-sm">
          {formatDuration(total)}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
          No events in this range
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="90%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  formatDuration(Number(value)),
                  String(name),
                ]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend: every category is direct-labeled here since a colored dot
          alone would leave identity resting on color perception alone. */}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function LayerDonuts({ summary }: { summary: AnalyticsSummary }) {
  const planned = summary.breakdown
    .filter((entry) => entry.plannedMinutes > 0)
    .map((entry) => ({
      name: entry.categoryName,
      value: entry.plannedMinutes,
      color: entry.color,
    }));

  const actual = summary.breakdown
    .filter((entry) => entry.actualMinutes > 0)
    .map((entry) => ({
      name: entry.categoryName,
      value: entry.actualMinutes,
      color: entry.color,
    }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Donut title="Planned" total={summary.totalPlannedMinutes} slices={planned} />
      <Donut title="Actual" total={summary.totalActualMinutes} slices={actual} />
    </div>
  );
}
