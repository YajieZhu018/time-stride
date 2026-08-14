"use client";

import { isSameDay, isSameMonth, format } from "date-fns";
import { cn } from "@/lib/utils";
import type { TimeEvent } from "@/types";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

export function MonthView({
  days,
  monthAnchor,
  events,
  onSelectDay,
  onSelectEvent,
}: {
  days: Date[];
  monthAnchor: Date;
  events: TimeEvent[];
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: TimeEvent) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/40 grid grid-cols-7 border-b text-center text-xs font-medium uppercase">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthAnchor);
          const today = isSameDay(day, new Date());
          const dayEvents = events
            .filter((event) => isSameDay(event.startTime, day))
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
          const overflow = dayEvents.length - MAX_CHIPS;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "border-border/60 flex min-h-28 flex-col items-stretch gap-1 border-b border-r p-1.5 text-left last:border-r-0",
                !inMonth && "bg-muted/20 text-muted-foreground",
                "hover:bg-accent/40 transition-colors",
              )}
            >
              <span
                className={cn(
                  "self-end rounded-full px-1.5 text-xs",
                  today && "bg-primary text-primary-foreground font-semibold",
                )}
              >
                {format(day, "d")}
              </span>

              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                  <span
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onSelectEvent(event);
                    }}
                    className={cn(
                      "truncate rounded px-1 py-px text-[10px] font-medium",
                      event.layer === "PLANNED"
                        ? "border border-dashed"
                        : "text-white",
                    )}
                    style={
                      event.layer === "PLANNED"
                        ? { borderColor: event.category.color }
                        : { backgroundColor: event.category.color }
                    }
                  >
                    {event.title}
                  </span>
                ))}
                {overflow > 0 ? (
                  <span className="text-muted-foreground text-[10px]">
                    +{overflow} more
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
