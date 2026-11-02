"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { endOfDay, format, isSameDay, startOfDay } from "date-fns";
import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import { packOverlaps } from "@/lib/layout-utils";
import { overlapsRange, snapToGrid } from "@/lib/time-utils";
import { EventBlock } from "@/components/calendar/event-block";
import {
  DEFAULT_SCROLL_HOUR,
  HOUR_HEIGHT,
  PIXELS_PER_MINUTE,
} from "@/components/calendar/grid-constants";
import type { EventLayer, TimeEvent, ViewFilterMode } from "@/types";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Width of the hour-label gutter, and the narrowest a single track may get
 *  before the grid scrolls sideways instead of squeezing (phones, week view). */
const GUTTER_PX = 48;
const MIN_TRACK_PX = 64;

/** "7 AM" / "12 PM", Google-Calendar style. */
function hourLabel(hour: number): string {
  if (hour === 0) return "";
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12} ${suffix}`;
}

interface TimeGridProps {
  days: Date[];
  events: TimeEvent[];
  filter: ViewFilterMode;
  onSelectEvent: (event: TimeEvent) => void;
  onCreateAt: (start: Date, layer: EventLayer) => void;
  /** Drag-to-move or resize-handle drag ended with new, already-snapped times. */
  onCommitTime: (event: TimeEvent, startTime: Date, endTime: Date) => void;
}

/** Which layers get a track, and how wide each is, for the current filter. */
function tracksFor(filter: ViewFilterMode): EventLayer[] {
  if (filter === "PLANNED_ONLY") return ["PLANNED"];
  if (filter === "ACTUAL_ONLY") return ["ACTUAL"];
  return ["PLANNED", "ACTUAL"];
}

/**
 * The dual-layer grid from spec.md §5.3.
 *
 * Each day column is split into sub-tracks: PLANNED on the left (translucent,
 * dashed) and ACTUAL on the right (solid). They share one timeline, so the gap
 * between intention and reality is readable at a glance rather than requiring
 * the two to be toggled back and forth.
 */
export function TimeGrid({
  days,
  events,
  filter,
  onSelectEvent,
  onCreateAt,
  onCommitTime,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = tracksFor(filter);

  // Ticks once a minute so the "now" line creeps down without re-rendering
  // every second.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // A small activation distance lets a plain click still register as a click
  // rather than being swallowed as a zero-length drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd({ active, delta }: DragEndEvent) {
    const event = active.data.current?.event as TimeEvent | undefined;
    if (!event) return;

    const deltaMinutes = snapToGrid(delta.y / PIXELS_PER_MINUTE);
    if (deltaMinutes === 0) return;

    const deltaMs = deltaMinutes * 60_000;
    onCommitTime(
      event,
      new Date(event.startTime.getTime() + deltaMs),
      new Date(event.endTime.getTime() + deltaMs),
    );
  }

  // Land one hour above "now" when today is on screen, so the current moment
  // is visible; otherwise fall back to the start of a normal day.
  const showsToday = days.some((day) => isSameDay(day, new Date()));
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const hour = showsToday
      ? Math.max(0, new Date().getHours() - 1)
      : DEFAULT_SCROLL_HOUR;
    node.scrollTop = hour * HOUR_HEIGHT;
  }, [showsToday]);

  const eventsByDay = useMemo(() => {
    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const range = { start: dayStart, end: dayEnd };

      return {
        day,
        dayStart,
        dayEnd,
        byLayer: Object.fromEntries(
          layers.map((layer) => [
            layer,
            packOverlaps(
              events.filter(
                (event) =>
                  event.layer === layer &&
                  overlapsRange(event.startTime, event.endTime, range),
              ),
            ),
          ]),
        ),
      };
    });
  }, [days, events, layers]);

  /** Translate a click inside a track into a snapped start time. */
  function handleTrackClick(
    clickEvent: React.MouseEvent<HTMLDivElement>,
    day: Date,
    layer: EventLayer,
  ) {
    // Clicks that landed on a block bubble up here too; ignore those.
    if (clickEvent.target !== clickEvent.currentTarget) return;

    const bounds = clickEvent.currentTarget.getBoundingClientRect();
    const offsetY = clickEvent.clientY - bounds.top;
    const minutes = snapToGrid(offsetY / PIXELS_PER_MINUTE);

    const start = startOfDay(day);
    start.setMinutes(Math.min(minutes, 24 * 60 - 15));
    onCreateAt(start, layer);
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
     <div
      style={{ minWidth: GUTTER_PX + days.length * layers.length * MIN_TRACK_PX }}
     >
      {/* Day headers, held above the scrolling body. */}
      <div className="bg-background flex border-b">
        <div className="shrink-0 border-r" style={{ width: GUTTER_PX }} />
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex-1 border-r px-1 py-2 text-center last:border-r-0",
              )}
            >
              <div
                className={cn(
                  "text-muted-foreground text-[11px] font-medium uppercase",
                  today && "text-primary",
                )}
              >
                {format(day, "EEE")}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-base font-medium",
                  today && "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {filter === "BOTH" ? (
        <div className="text-muted-foreground bg-muted/20 flex border-b text-[10px] uppercase tracking-wide">
          <div className="shrink-0 border-r" style={{ width: GUTTER_PX }} />
          {days.map((day) => (
            <div key={day.toISOString()} className="flex flex-1 border-r last:border-r-0">
              <div className="flex-1 border-r px-1 py-0.5 text-center">Plan</div>
              <div className="flex-1 px-1 py-0.5 text-center">Actual</div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="h-[calc(100dvh-15rem)] min-h-80 overflow-y-auto overscroll-contain sm:h-auto sm:max-h-[calc(100dvh-19rem)]"
      >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex">
          {/* Hour gutter */}
          <div className="shrink-0 border-r" style={{ width: GUTTER_PX }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-muted-foreground relative text-[10px]"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-1.5 right-1.5">
                  {hourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {eventsByDay.map(({ day, dayStart, dayEnd, byLayer }) => (
            <div
              key={day.toISOString()}
              className="relative flex-1 border-r last:border-r-0"
              style={{ height: 24 * HOUR_HEIGHT }}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-border/60 pointer-events-none absolute inset-x-0 border-t"
                  style={{ top: hour * HOUR_HEIGHT }}
                />
              ))}
              {/* Faint half-hour guides */}
              {HOURS.map((hour) => (
                <div
                  key={`half-${hour}`}
                  className="border-border/30 pointer-events-none absolute inset-x-0 border-t border-dotted"
                  style={{ top: (hour + 0.5) * HOUR_HEIGHT }}
                />
              ))}

              <div className="absolute inset-0 flex">
                {layers.map((layer) => (
                  <div
                    key={layer}
                    className={cn(
                      "relative h-full flex-1",
                      layer === "PLANNED" && layers.length > 1 && "border-r border-dashed",
                    )}
                    onClick={(clickEvent) =>
                      handleTrackClick(clickEvent, day, layer)
                    }
                  >
                    {byLayer[layer]?.map((positioned) => (
                      <EventBlock
                        key={positioned.event.id}
                        positioned={positioned}
                        dayStart={dayStart}
                        dayEnd={dayEnd}
                        onSelect={onSelectEvent}
                        onCommitTime={onCommitTime}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {isSameDay(day, now) ? (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                  style={{
                    top:
                      ((now.getHours() * 60 + now.getMinutes()) / 60) *
                      HOUR_HEIGHT,
                  }}
                >
                  <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-red-500" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </DndContext>
      </div>
     </div>
    </div>
  );
}
