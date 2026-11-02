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
} from "@/components/calendar/grid-constants";
import type { EventLayer, TimeEvent, ViewFilterMode } from "@/types";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Hour-label gutter; narrower on phones so the week's columns get the room. */
const GUTTER_CLASS = "w-9 sm:w-12";

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
  /** Squeeze all 24 hours into the available height, so nothing scrolls. */
  fit?: boolean;
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
  fit = false,
  onSelectEvent,
  onCreateAt,
  onCommitTime,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layers = tracksFor(filter);

  // In fit mode the hour height is whatever makes 24 hours fill the scroll
  // area, re-measured on resize / rotation.
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (!fit || !node) return;
    const observer = new ResizeObserver(() =>
      setFitHeight(node.clientHeight / 24),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fit]);
  const hourHeight = fit ? (fitHeight ?? HOUR_HEIGHT) : HOUR_HEIGHT;
  const pixelsPerMinute = hourHeight / 60;
  // Skip labels / half-hour guides once rows get too tight to hold them.
  const labelStep = hourHeight >= 24 ? 1 : hourHeight >= 14 ? 2 : 3;
  const showHalfHours = hourHeight >= 30;

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

    const deltaMinutes = snapToGrid(delta.y / pixelsPerMinute);
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
    if (!node || fit) return;
    const hour = showsToday
      ? Math.max(0, new Date().getHours() - 1)
      : DEFAULT_SCROLL_HOUR;
    node.scrollTop = hour * HOUR_HEIGHT;
  }, [showsToday, fit]);

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
    const minutes = snapToGrid(offsetY / pixelsPerMinute);

    const start = startOfDay(day);
    start.setMinutes(Math.min(minutes, 24 * 60 - 15));
    onCreateAt(start, layer);
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", fit && "h-full")}>
     <div className={cn(fit && "flex h-full flex-col")}>
      {/* Day headers, held above the scrolling body. */}
      <div className="bg-background flex border-b">
        <div className={cn("shrink-0 border-r", GUTTER_CLASS)} />
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-w-0 flex-1 border-r px-0.5 py-1.5 text-center last:border-r-0 sm:px-1 sm:py-2",
              )}
            >
              <div
                className={cn(
                  "text-muted-foreground text-[10px] font-medium uppercase sm:text-[11px]",
                  today && "text-primary",
                )}
              >
                {format(day, "EEE")}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-medium sm:size-8 sm:text-base",
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
          <div className={cn("shrink-0 border-r", GUTTER_CLASS)} />
          {days.map((day) => (
            <div key={day.toISOString()} className="flex min-w-0 flex-1 border-r last:border-r-0">
              <div className="flex-1 border-r px-0.5 py-0.5 text-center">
                P<span className="hidden sm:inline">lan</span>
              </div>
              <div className="flex-1 px-0.5 py-0.5 text-center">
                A<span className="hidden sm:inline">ctual</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={cn(
          "overflow-y-auto overscroll-contain",
          fit
            ? "min-h-0 flex-1 overflow-hidden"
            : "h-[calc(100dvh-15rem)] min-h-80 sm:h-auto sm:max-h-[calc(100dvh-19rem)]",
        )}
      >
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex">
          {/* Hour gutter */}
          <div className={cn("shrink-0 border-r", GUTTER_CLASS)}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-muted-foreground relative text-[10px]"
                style={{ height: hourHeight }}
              >
                <span className="absolute -top-1.5 right-1.5">
                  {hour % labelStep === 0 ? hourLabel(hour) : ""}
                </span>
              </div>
            ))}
          </div>

          {eventsByDay.map(({ day, dayStart, dayEnd, byLayer }) => (
            <div
              key={day.toISOString()}
              className="relative min-w-0 flex-1 border-r last:border-r-0"
              style={{ height: 24 * hourHeight }}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-border/60 pointer-events-none absolute inset-x-0 border-t"
                  style={{ top: hour * hourHeight }}
                />
              ))}
              {/* Faint half-hour guides */}
              {(showHalfHours ? HOURS : []).map((hour) => (
                <div
                  key={`half-${hour}`}
                  className="border-border/30 pointer-events-none absolute inset-x-0 border-t border-dotted"
                  style={{ top: (hour + 0.5) * hourHeight }}
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
                        hourHeight={hourHeight}
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
                      hourHeight,
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
