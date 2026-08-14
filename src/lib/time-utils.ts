import {
  addDays,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import type { CalendarViewMode } from "@/types";

export const MINUTES_PER_DAY = 24 * 60;
/** Grid resolution: every drag, resize and manual entry snaps to this. */
export const SNAP_MINUTES = 15;
/** Week starts Monday throughout the app. */
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export interface DateRange {
  start: Date;
  end: Date;
}

/** Minutes from midnight of the date's own day. */
export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function snapToGrid(minutes: number, snap = SNAP_MINUTES): number {
  return Math.round(minutes / snap) * snap;
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.max(0, differenceInMinutes(end, start));
}

/**
 * Minutes of an event that fall inside a range. Clipping rather than
 * all-or-nothing counting keeps totals correct for events straddling a
 * week or month boundary, and stops the same event being counted twice
 * across two adjacent ranges.
 */
export function minutesWithinRange(
  start: Date,
  end: Date,
  range: DateRange,
): number {
  const from = start > range.start ? start : range.start;
  const to = end < range.end ? end : range.end;
  return Math.max(0, differenceInMinutes(to, from));
}

export function overlapsRange(
  start: Date,
  end: Date,
  range: DateRange,
): boolean {
  return start < range.end && end > range.start;
}

/** The visible window for a calendar view, anchored on `date`. */
export function rangeForView(date: Date, view: CalendarViewMode): DateRange {
  switch (view) {
    case "day":
      return { start: startOfDay(date), end: endOfDay(date) };
    case "week":
      return {
        start: startOfWeek(date, WEEK_OPTIONS),
        end: endOfWeek(date, WEEK_OPTIONS),
      };
    case "month":
      // Pad to whole weeks so the month grid's leading/trailing days have data.
      return {
        start: startOfWeek(startOfMonth(date), WEEK_OPTIONS),
        end: endOfWeek(endOfMonth(date), WEEK_OPTIONS),
      };
    case "year":
      return { start: startOfYear(date), end: endOfYear(date) };
  }
}

export function daysInRange(range: DateRange): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(range.start);
  while (cursor <= range.end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** "3.5 hrs", "45 min", "2 hrs 15 min" — for insight copy and KPI cards. */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs} min`;
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  if (rest === 0) return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
  return `${hours} ${hours === 1 ? "hr" : "hrs"} ${rest} min`;
}

/** Decimal-hours form used in the spec's insight copy ("by 3.5 hrs"). */
export function formatHours(minutes: number): string {
  const hours = Math.abs(minutes) / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} ${rounded === 1 ? "hr" : "hrs"}`;
}

export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Combine a `yyyy-MM-dd` and `HH:mm` pair from form inputs into a local Date. */
export function fromDateAndTimeInputs(dateValue: string, timeValue: string): Date {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}
