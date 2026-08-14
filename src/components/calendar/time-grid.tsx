"use client";

import { useEffect, useMemo, useRef } from "react";
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

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT;
  }, []);

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
    <div className="overflow-hidden rounded-lg border">
      {/* Day headers, held above the scrolling body. */}
      <div className="bg-muted/40 flex border-b">
        <div className="w-14 shrink-0 border-r" />
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex-1 border-r px-2 py-2 text-center last:border-r-0",
                today && "bg-primary/10",
              )}
            >
              <div className="text-muted-foreground text-xs uppercase">
                {format(day, "EEE")}
              </div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  today && "text-primary",
                )}
              >
                {format(day, "d MMM")}
              </div>
            </div>
          );
        })}
      </div>

      {filter === "BOTH" ? (
        <div className="text-muted-foreground bg-muted/20 flex border-b text-[10px] uppercase tracking-wide">
          <div className="w-14 shrink-0 border-r" />
          {days.map((day) => (
            <div key={day.toISOString()} className="flex flex-1 border-r last:border-r-0">
              <div className="flex-1 border-r px-1 py-0.5 text-center">Plan</div>
              <div className="flex-1 px-1 py-0.5 text-center">Actual</div>
            </div>
          ))}
        </div>
      ) : null}

      <div ref={scrollRef} className="max-h-[calc(100vh-19rem)] overflow-y-auto">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex">
          {/* Hour gutter */}
          <div className="w-14 shrink-0 border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-muted-foreground relative text-[10px]"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-1.5 right-1">
                  {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
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
            </div>
          ))}
        </div>
      </DndContext>
      </div>
    </div>
  );
}
