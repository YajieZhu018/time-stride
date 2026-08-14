import { Frequency, RRule, rrulestr } from "rrule";
import type { TimeEvent } from "@/types";
import { overlapsRange, type DateRange } from "@/lib/time-utils";

/** Safety valve: a malformed rule must not be able to hang a page render. */
const MAX_OCCURRENCES = 1000;

/**
 * rrule evaluates everything in UTC. Passing a local Date directly makes a
 * 09:00 Berlin event drift to 07:00 or 08:00 depending on the season, and
 * shifts weekly events onto the wrong weekday near midnight.
 *
 * The fix is to hand rrule a "floating" date whose UTC fields hold the local
 * wall-clock values, then unwrap it the same way. Recurrence then means
 * "09:00 local, whatever the offset happens to be that week", which is what a
 * calendar user expects across a DST boundary.
 */
function toFloatingUtc(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      0,
      0,
    ),
  );
}

function fromFloatingUtc(date: Date): Date {
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    0,
    0,
  );
}

const FREQUENCY_MAP: Record<string, Frequency | undefined> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
};

function buildRule(event: TimeEvent): RRule | null {
  const dtstart = toFloatingUtc(event.startTime);
  const until = event.recurrenceEnd
    ? toFloatingUtc(event.recurrenceEnd)
    : undefined;

  try {
    // An explicit RRULE always wins; CUSTOM has nothing else to go on.
    if (event.rruleString) {
      const parsed = rrulestr(event.rruleString);
      return new RRule({ ...parsed.origOptions, dtstart, until });
    }

    const freq = FREQUENCY_MAP[event.frequency];
    if (freq === undefined) return null;

    return new RRule({ freq, dtstart, until });
  } catch (error) {
    console.error(
      `[rrule-utils] could not build a rule for event ${event.id}:`,
      error,
    );
    return null;
  }
}

/** One in-memory occurrence of a recurring base event. */
function instanceFor(base: TimeEvent, start: Date): TimeEvent {
  return {
    ...base,
    // Synthetic id — this row does not exist in the database. `parentEventId`
    // carries the real id, so edits and drags know what to write back to.
    id: `${base.id}::${start.toISOString()}`,
    parentEventId: base.id,
    isSyntheticInstance: true,
    startTime: start,
    endTime: new Date(start.getTime() + base.duration * 60_000),
  };
}

/** Has this occurrence start been skipped or replaced by an override row? */
function isExcluded(occurrenceStart: Date, exDates: Date[] | undefined): boolean {
  if (!exDates?.length) return false;
  const time = occurrenceStart.getTime();
  return exDates.some((exDate) => exDate.getTime() === time);
}

/**
 * Expand recurring base events across a viewing window (spec.md §5.1).
 * Non-recurring events pass through untouched if they overlap the window.
 */
export function expandEvents(
  events: TimeEvent[],
  range: DateRange,
): TimeEvent[] {
  const expanded: TimeEvent[] = [];

  for (const event of events) {
    if (event.frequency === "ONCE") {
      if (overlapsRange(event.startTime, event.endTime, range)) {
        expanded.push(event);
      }
      continue;
    }

    const rule = buildRule(event);
    if (!rule) {
      // Unusable recurrence: fall back to the base event so the user's data
      // still shows up somewhere rather than vanishing silently.
      if (overlapsRange(event.startTime, event.endTime, range)) {
        expanded.push(event);
      }
      continue;
    }

    // Search from one duration before the window so an occurrence that starts
    // earlier but runs into the window is still found.
    const searchStart = new Date(
      range.start.getTime() - event.duration * 60_000,
    );

    const occurrences = rule
      .between(toFloatingUtc(searchStart), toFloatingUtc(range.end), true)
      .slice(0, MAX_OCCURRENCES);

    for (const occurrence of occurrences) {
      const start = fromFloatingUtc(occurrence);

      // `until` is inclusive of the occurrence start, but an occurrence
      // starting after the series end must never appear.
      if (event.recurrenceEnd && start > event.recurrenceEnd) continue;

      // Skipped, or replaced by a standalone override row fetched separately.
      if (isExcluded(start, event.exDates)) continue;

      const instance = instanceFor(event, start);
      if (overlapsRange(instance.startTime, instance.endTime, range)) {
        expanded.push(instance);
      }
    }
  }

  return expanded.sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );
}

/**
 * The real database id to write edits back to. A synthetic instance has no
 * row of its own, so this resolves to its series' base event; a persisted
 * override (or any ordinary event) is already its own row.
 */
export function baseEventId(event: TimeEvent): string {
  return event.isSyntheticInstance && event.parentEventId
    ? event.parentEventId
    : event.id;
}

/** True for a synthetic instance or a persisted single-occurrence override — either way, part of a series. */
export function isRecurringInstance(event: TimeEvent): boolean {
  return Boolean(event.parentEventId);
}

/** True only for an in-memory occurrence with no database row of its own. */
export function isSyntheticInstance(event: TimeEvent): boolean {
  return Boolean(event.isSyntheticInstance);
}

/** Human-readable recurrence summary for event cards, e.g. "Every week". */
export function describeRecurrence(
  event: Pick<TimeEvent, "frequency" | "rruleString">,
): string | null {
  if (event.frequency === "ONCE") return null;

  if (event.rruleString) {
    try {
      return rrulestr(event.rruleString).toText();
    } catch {
      return "Custom recurrence";
    }
  }

  switch (event.frequency) {
    case "DAILY":
      return "Every day";
    case "WEEKLY":
      return "Every week";
    case "MONTHLY":
      return "Every month";
    default:
      return "Custom recurrence";
  }
}
