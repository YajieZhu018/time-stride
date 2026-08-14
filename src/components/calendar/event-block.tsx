"use client";

import { useCallback, useRef, useState } from "react";
import { format } from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { isSyntheticInstance } from "@/lib/rrule-utils";
import type { PositionedEvent } from "@/lib/layout-utils";
import { HOUR_HEIGHT, PIXELS_PER_MINUTE } from "@/components/calendar/grid-constants";
import { minutesFromMidnight, snapToGrid } from "@/lib/time-utils";
import type { TimeEvent } from "@/types";

/** Minimum block duration a resize can shrink to. */
const MIN_DURATION_MINUTES = 15;

/** Hex → rgba, so a planned block can be translucent without opacity tricks
 *  that would also fade its text. */
function withAlpha(hex: string, alpha: number): string {
  const normalised =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(normalised.slice(1, 3), 16);
  const g = parseInt(normalised.slice(3, 5), 16);
  const b = parseInt(normalised.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface EventBlockGeometry {
  top: number;
  height: number;
  left: string;
  width: string;
}

/**
 * Geometry for one block inside its track. `dayStart` matters for events that
 * begin on a previous day: the block is clipped to the top of this column
 * rather than being positioned off-screen.
 */
export function geometryFor(
  positioned: PositionedEvent,
  dayStart: Date,
  dayEnd: Date,
): EventBlockGeometry {
  const { event, column, columns } = positioned;

  const startsBefore = event.startTime < dayStart;
  const endsAfter = event.endTime > dayEnd;

  const startMinutes = startsBefore ? 0 : minutesFromMidnight(event.startTime);
  const endMinutes = endsAfter
    ? 24 * 60
    : minutesFromMidnight(event.endTime) ||
      // An event ending exactly at midnight reads as minute 0; treat as 1440.
      (event.endTime > event.startTime ? 24 * 60 : 0);

  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const rawHeight = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

  return {
    top,
    // Keep very short events clickable.
    height: Math.max(rawHeight, 14),
    left: `${(column / columns) * 100}%`,
    width: `${100 / columns}%`,
  };
}

type ResizeEdge = "top" | "bottom";

export function EventBlock({
  positioned,
  dayStart,
  dayEnd,
  onSelect,
  onCommitTime,
}: {
  positioned: PositionedEvent;
  dayStart: Date;
  dayEnd: Date;
  onSelect?: (event: TimeEvent) => void;
  /** Fired once a drag or resize ends, with the new times already snapped. */
  onCommitTime?: (event: TimeEvent, startTime: Date, endTime: Date) => void;
}) {
  const { event } = positioned;
  const geometry = geometryFor(positioned, dayStart, dayEnd);
  const isPlanned = event.layer === "PLANNED";

  // Expanded recurring instances don't exist as their own database row (see
  // rrule-utils.ts) until the user turns one into a persisted override —
  // dragging a bare synthetic instance is disabled; use the dialog's "this
  // occurrence only" edit to give it its own row first.
  const isInstance = isSyntheticInstance(event);

  const [resize, setResize] = useState<{
    edge: ResizeEdge;
    offsetMinutes: number;
  } | null>(null);
  const resizeStateRef = useRef<{
    edge: ResizeEdge;
    startY: number;
    offsetMinutes: number;
  } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: event.id,
      data: { event },
      disabled: isInstance,
    });

  // A single stable handler (edge read from a data attribute) rather than a
  // per-edge closure factory called during render: writing to a ref from
  // inside a closure created at render time is what the React Compiler's ref
  // rule flags, even though the write only ever actually runs from the
  // pointerdown callback itself.
  const handleResizePointerDown = useCallback(
    (pointerEvent: React.PointerEvent<HTMLSpanElement>) => {
      if (isInstance) return;
      const edge = pointerEvent.currentTarget.dataset.edge as ResizeEdge;
      pointerEvent.stopPropagation();
      pointerEvent.preventDefault();

      resizeStateRef.current = { edge, startY: pointerEvent.clientY, offsetMinutes: 0 };
      setResize({ edge, offsetMinutes: 0 });

      function handleMove(moveEvent: PointerEvent) {
        const state = resizeStateRef.current;
        if (!state) return;
        const deltaY = moveEvent.clientY - state.startY;
        const offsetMinutes = snapToGrid(deltaY / PIXELS_PER_MINUTE);
        state.offsetMinutes = offsetMinutes;
        setResize({ edge: state.edge, offsetMinutes });
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);

        const state = resizeStateRef.current;
        resizeStateRef.current = null;
        setResize(null);
        if (!state || state.offsetMinutes === 0) return;

        const deltaMs = state.offsetMinutes * 60_000;
        let newStart = event.startTime;
        let newEnd = event.endTime;

        if (state.edge === "top") {
          newStart = new Date(event.startTime.getTime() + deltaMs);
          if (newEnd.getTime() - newStart.getTime() < MIN_DURATION_MINUTES * 60_000) {
            newStart = new Date(newEnd.getTime() - MIN_DURATION_MINUTES * 60_000);
          }
        } else {
          newEnd = new Date(event.endTime.getTime() + deltaMs);
          if (newEnd.getTime() - newStart.getTime() < MIN_DURATION_MINUTES * 60_000) {
            newEnd = new Date(newStart.getTime() + MIN_DURATION_MINUTES * 60_000);
          }
        }

        onCommitTime?.(event, newStart, newEnd);
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [isInstance, event, onCommitTime],
  );

  // Live-preview geometry: resize offsets one edge only; drag translates the
  // whole block via a CSS transform (dnd-kit) rather than touching geometry.
  const previewTop =
    resize?.edge === "top" ? geometry.top + resize.offsetMinutes * PIXELS_PER_MINUTE : geometry.top;
  const previewHeight =
    resize && resize.offsetMinutes !== 0
      ? Math.max(
          14,
          resize.edge === "top"
            ? geometry.height - resize.offsetMinutes * PIXELS_PER_MINUTE
            : geometry.height + resize.offsetMinutes * PIXELS_PER_MINUTE,
        )
      : geometry.height;

  const compact = previewHeight < 34;

  return (
    <div
      ref={setNodeRef}
      className="absolute px-px"
      style={{
        top: previewTop,
        height: previewHeight,
        left: geometry.left,
        width: geometry.width,
        transform: transform
          ? `translate3d(0, ${transform.y}px, 0)`
          : undefined,
        zIndex: isDragging || resize ? 30 : undefined,
      }}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={() => onSelect?.(event)}
        title={`${event.title} · ${format(event.startTime, "HH:mm")}–${format(event.endTime, "HH:mm")}`}
        className={cn(
          "group relative flex size-full flex-col overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight transition-shadow",
          "hover:ring-ring/60 hover:ring-2 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          isPlanned
            ? "border border-dashed text-foreground/90"
            : "text-white shadow-sm",
          !isInstance && "touch-none",
          (isDragging || resize) && "opacity-80 shadow-lg",
        )}
        style={
          isPlanned
            ? {
                backgroundColor: withAlpha(event.category.color, 0.18),
                borderColor: event.category.color,
              }
            : { backgroundColor: event.category.color }
        }
      >
        <span className="truncate font-medium">{event.title}</span>
        {compact ? null : (
          <span className={cn("truncate", isPlanned ? "text-muted-foreground" : "text-white/80")}>
            {format(event.startTime, "HH:mm")}–{format(event.endTime, "HH:mm")}
          </span>
        )}

        {!isInstance ? (
          <>
            <span
              data-edge="top"
              onPointerDown={handleResizePointerDown}
              className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
            />
            <span
              data-edge="bottom"
              onPointerDown={handleResizePointerDown}
              className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
            />
          </>
        ) : null}
      </button>
    </div>
  );
}
