import { CircleCheck, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { AnalyticsInsight } from "@/types";

const TONE_STYLES: Record<
  AnalyticsInsight["tone"],
  { icon: typeof TrendingUp; className: string }
> = {
  over: { icon: TrendingUp, className: "text-[#2a78d6]" },
  under: { icon: TrendingDown, className: "text-[#e34948]" },
  onTrack: { icon: CircleCheck, className: "text-[#0ca30c]" },
};

export function InsightAlerts({ insights }: { insights: AnalyticsInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Insights</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {insights.map((insight) => {
          const tone = TONE_STYLES[insight.tone];
          const Icon = tone.icon;
          return (
            <Alert key={insight.categoryId + insight.message} className="py-2">
              <Icon className={cn("size-4", tone.className)} />
              <AlertDescription>{insight.message}</AlertDescription>
            </Alert>
          );
        })}
      </div>
    </div>
  );
}
