import { Clock, ListChecks, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDuration, formatHours } from "@/lib/time-utils";
import type { AnalyticsSummary } from "@/types";

function adherenceStatus(score: number): {
  label: string;
  className: string;
} {
  // Fixed status scale (never reused for series identity): higher adherence
  // is unambiguously better, unlike variance direction which is neutral.
  if (score >= 80) return { label: "On track", className: "text-[#0ca30c]" };
  if (score >= 50) return { label: "Drifting", className: "text-[#fab219]" };
  return { label: "Off plan", className: "text-[#d03b3b]" };
}

export function KpiCards({ summary }: { summary: AnalyticsSummary }) {
  const variance = summary.totalActualMinutes - summary.totalPlannedMinutes;
  const status = adherenceStatus(summary.adherenceScore);

  const tiles = [
    {
      label: "Adherence score",
      value: `${Math.round(summary.adherenceScore)}%`,
      icon: ListChecks,
      note: status.label,
      noteClassName: status.className,
    },
    {
      label: "Planned time",
      value: formatDuration(summary.totalPlannedMinutes),
      icon: Clock,
      note: null,
      noteClassName: "",
    },
    {
      label: "Actual time",
      value: formatDuration(summary.totalActualMinutes),
      icon: Clock,
      note: null,
      noteClassName: "",
    },
    {
      label: variance >= 0 ? "Over plan" : "Under plan",
      value: formatHours(variance),
      icon: variance >= 0 ? TrendingUp : TrendingDown,
      note: variance >= 0 ? "more than planned" : "less than planned",
      noteClassName: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="gap-1.5 p-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
            <tile.icon className="size-3.5" />
            {tile.label}
          </div>
          <div className="text-2xl font-semibold">{tile.value}</div>
          {tile.note ? (
            <div className={cn("text-xs", tile.noteClassName)}>{tile.note}</div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
