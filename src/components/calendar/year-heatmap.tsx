"use client";

import { useMemo } from "react";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { calculateAnalytics } from "@/lib/analytics-utils";
import { WEEK_OPTIONS } from "@/lib/time-utils";
import type { TimeEvent } from "@/types";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Adherence intensity → cell colour. Empty days (no planned or actual time
 * logged) are visually distinct from a *perfect* day rather than reading as
 * "100% adherence", since `calculateAnalytics` returns 100 for an empty range.
 */
function cellClass(adherence: number, hasData: boolean): string {
  if (!hasData) return "bg-muted";
  if (adherence >= 90) return "bg-emerald-600";
  if (adherence >= 75) return "bg-emerald-500/70";
  if (adherence >= 50) return "bg-amber-500/70";
  if (adherence >= 25) return "bg-orange-500/70";
  return "bg-red-500/70";
}

export function YearHeatmap({
  year,
  events,
  onSelectDay,
}: {
  year: number;
  events: TimeEvent[];
  onSelectDay: (day: Date) => void;
}) {
  const weeks = useMemo(() => {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const gridStart = startOfWeek(yearStart, WEEK_OPTIONS);
    const gridEnd = endOfWeek(yearEnd, WEEK_OPTIONS);
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const cells = allDays.map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayEvents = events.filter(
        (event) => event.startTime < dayEnd && event.endTime > dayStart,
      );
      const hasData = dayEvents.length > 0;
      const summary = calculateAnalytics(dayEvents, {
        start: dayStart,
        end: dayEnd,
      });

      return { day, adherence: summary.adherenceScore, hasData };
    });

    const result: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [year, events]);

  const monthMarkers = useMemo(() => {
    const markers: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const firstOfMonthDay = week.find((cell) => cell.day.getDate() <= 7);
      if (firstOfMonthDay && firstOfMonthDay.day.getMonth() !== lastMonth) {
        lastMonth = firstOfMonthDay.day.getMonth();
        markers.push({ label: MONTH_LABELS[lastMonth], weekIndex });
      }
    });
    return markers;
  }, [weeks]);

  return (
    <div className="space-y-2 overflow-x-auto pb-2">
      <div
        className="relative ml-8 text-xs text-muted-foreground"
        style={{ height: 16, width: weeks.length * 15 }}
      >
        {monthMarkers.map((marker) => (
          <span
            key={marker.label + marker.weekIndex}
            className="absolute"
            style={{ left: marker.weekIndex * 15 }}
          >
            {marker.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="text-muted-foreground flex w-6 flex-col justify-between gap-px py-px text-[10px]">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>

        <div className="flex gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((cell) => {
                const inYear = cell.day.getFullYear() === year;
                return (
                  <button
                    key={cell.day.toISOString()}
                    type="button"
                    disabled={!inYear}
                    onClick={() => onSelectDay(cell.day)}
                    title={`${format(cell.day, "d MMM yyyy")} · ${
                      cell.hasData ? `${Math.round(cell.adherence)}% adherence` : "No events"
                    }`}
                    className={`size-3 rounded-sm transition-transform hover:scale-125 ${
                      inYear ? cellClass(cell.adherence, cell.hasData) : "invisible"
                    } ${isSameDay(cell.day, new Date()) ? "ring-primary ring-1" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>Low adherence</span>
        <span className="size-3 rounded-sm bg-red-500/70" />
        <span className="size-3 rounded-sm bg-orange-500/70" />
        <span className="size-3 rounded-sm bg-amber-500/70" />
        <span className="size-3 rounded-sm bg-emerald-500/70" />
        <span className="size-3 rounded-sm bg-emerald-600" />
        <span>High adherence</span>
        <span className="ml-2 flex items-center gap-1">
          <span className="bg-muted size-3 rounded-sm" /> No events
        </span>
      </div>
    </div>
  );
}
