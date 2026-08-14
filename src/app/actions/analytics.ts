"use server";

import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { toTimeEvent } from "@/lib/serialize";
import { expandEvents } from "@/lib/rrule-utils";
import { calculateAnalytics } from "@/lib/analytics-utils";
import type { AnalyticsSummary } from "@/types";

/**
 * Same range-fetch-then-expand path as the calendar
 * (`getEventsInRange` in actions/events.ts), so a recurring event
 * contributes to analytics for every occurrence in range, not just its base
 * row. Kept as a separate query rather than importing the calendar action, so
 * analytics has no dependency on calendar UI concerns.
 */
export async function getAnalyticsSummary(
  start: Date,
  end: Date,
): Promise<AnalyticsSummary> {
  const userId = await getCurrentUserId();

  const rows = await prisma.timeEvent.findMany({
    where: {
      userId,
      OR: [
        { frequency: "ONCE", startTime: { lt: end }, endTime: { gt: start } },
        {
          frequency: { not: "ONCE" },
          startTime: { lt: end },
          OR: [{ recurrenceEnd: null }, { recurrenceEnd: { gt: start } }],
        },
      ],
    },
    include: { category: true },
  });

  const events = expandEvents(rows.map(toTimeEvent), { start, end });
  return calculateAnalytics(events, { start, end });
}
