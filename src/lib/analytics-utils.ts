import type {
  AnalyticsInsight,
  AnalyticsSummary,
  CategoryAnalytics,
  TimeEvent,
} from "@/types";
import {
  formatHours,
  minutesWithinRange,
  overlapsRange,
  type DateRange,
} from "@/lib/time-utils";

/**
 * Variance and plan-adherence engine (spec.md §5.2).
 *
 * Deliberately pure — no Prisma import, no `Date.now()` — so it can be called
 * from a server component, a client component, or a test with equal safety, and
 * so the year heatmap can run it once per day over a single range query.
 */
export function calculateAnalytics(
  events: TimeEvent[],
  dateRange: DateRange,
): AnalyticsSummary {
  const buckets = new Map<string, CategoryAnalytics>();

  for (const event of events) {
    if (!overlapsRange(event.startTime, event.endTime, dateRange)) continue;

    const minutes = minutesWithinRange(
      event.startTime,
      event.endTime,
      dateRange,
    );
    if (minutes === 0) continue;

    let bucket = buckets.get(event.categoryId);
    if (!bucket) {
      bucket = {
        categoryId: event.categoryId,
        categoryName: event.category.name,
        color: event.category.color,
        plannedMinutes: 0,
        actualMinutes: 0,
        varianceMinutes: 0,
        variancePercentage: 0,
      };
      buckets.set(event.categoryId, bucket);
    }

    if (event.layer === "PLANNED") bucket.plannedMinutes += minutes;
    else bucket.actualMinutes += minutes;
  }

  let totalPlannedMinutes = 0;
  let totalActualMinutes = 0;
  let totalAbsoluteVariance = 0;

  const breakdown = [...buckets.values()].map((bucket) => {
    bucket.varianceMinutes = bucket.actualMinutes - bucket.plannedMinutes;
    // A category with no plan has no baseline to be a percentage of; reporting
    // 0% is honest, where dividing would yield Infinity.
    bucket.variancePercentage =
      bucket.plannedMinutes > 0
        ? (bucket.varianceMinutes / bucket.plannedMinutes) * 100
        : 0;

    totalPlannedMinutes += bucket.plannedMinutes;
    totalActualMinutes += bucket.actualMinutes;
    totalAbsoluteVariance += Math.abs(bucket.varianceMinutes);

    return bucket;
  });

  breakdown.sort((a, b) => b.actualMinutes - a.actualMinutes);

  return {
    totalPlannedMinutes,
    totalActualMinutes,
    adherenceScore: calculateAdherenceScore(
      totalAbsoluteVariance,
      totalPlannedMinutes + totalActualMinutes,
    ),
    breakdown,
    insights: buildInsights(breakdown),
  };
}

/**
 * Adherence = (1 - Σ|Pi - Ai| / (ΣP + ΣA)) × 100, per spec.md §5.2.
 *
 * An empty range has nothing to deviate from, so it scores 100 rather than
 * dividing by zero — this matters for the year heatmap, where most cells in a
 * fresh account have no events at all.
 */
function calculateAdherenceScore(
  totalAbsoluteVariance: number,
  totalMinutes: number,
): number {
  if (totalMinutes === 0) return 100;
  const score = (1 - totalAbsoluteVariance / totalMinutes) * 100;
  return Math.max(0, Math.min(100, score));
}

/** Human-readable feedback, e.g. "Underestimated Work by 3.5 hrs". */
function buildInsights(breakdown: CategoryAnalytics[]): AnalyticsInsight[] {
  return [...breakdown]
    .filter((entry) => entry.plannedMinutes > 0 || entry.actualMinutes > 0)
    .sort((a, b) => Math.abs(b.varianceMinutes) - Math.abs(a.varianceMinutes))
    .slice(0, 5)
    .map((entry) => {
      const { categoryId, categoryName, varianceMinutes } = entry;

      if (entry.plannedMinutes === 0) {
        return {
          categoryId,
          tone: "over" as const,
          message: `${formatHours(entry.actualMinutes)} of unplanned ${categoryName}`,
        };
      }

      if (entry.actualMinutes === 0) {
        return {
          categoryId,
          tone: "under" as const,
          message: `Skipped ${categoryName} entirely — ${formatHours(entry.plannedMinutes)} planned`,
        };
      }

      // Under 5 minutes of drift is noise, not a finding.
      if (Math.abs(varianceMinutes) < 5) {
        return {
          categoryId,
          tone: "onTrack" as const,
          message: `${categoryName} went to plan`,
        };
      }

      return varianceMinutes > 0
        ? {
            categoryId,
            tone: "over" as const,
            message: `Underestimated ${categoryName} by ${formatHours(varianceMinutes)}`,
          }
        : {
            categoryId,
            tone: "under" as const,
            message: `Overestimated ${categoryName} by ${formatHours(varianceMinutes)}`,
          };
    });
}
