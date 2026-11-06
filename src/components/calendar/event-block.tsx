"use client";

import { useCallback, useRef, useState } from "react";
import { format } from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { isSyntheticInstance } from "@/lib/rrule-utils";
import type { PositionedEvent } from "@/lib/layout-utils";
import { HOUR_HEIGHT } from "@/components/calendar/grid-constants";
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

/** Line height of a title in the full-screen grid; matches `leading-[11px]`. */
const DENSE_LINE_HEIGHT = 11;

/** Shortest a full-screen block may render: one whole line of title. */
const DENSE_MIN_BLOCK_HEIGHT = 12;

/** Shortest a block may render, which also keeps it clickable. */
function minBlockHeight(hourHeight: number, dense: boolean): number {
  return dense ? DENSE_MIN_BLOCK_HEIGHT : Math.min(14, hourHeight * 0.4);
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
  hourHeight: number = HOUR_HEIGHT,
  dense = false,
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

  const top = (startMinutes / 60) * hourHeight;
  const rawHeight = ((endMinutes - startMinutes) / 60) * hourHeight;

  return {
    top,
    // Keep very short events clickable.
    height: Math.max(rawHeight, minBlockHeight(hourHeight, dense)),
    left: `${(column / columns) * 100}%`,
    width: `${100 / columns}%`,
  };
}

/**
 * Geometry for every block of one full-screen track. There, a 30-minute event
 * is only a few pixels tall but is drawn one text line high, so it would cover
 * whatever starts right after it. Each block is pushed just below the blocks
 * above it instead, trimming its own top so it still ends on time, which keeps
 * every title readable at full width for a few pixels of timeline accuracy.
 * If that runs past midnight, a second pass from the bottom pulls blocks back
 * up, squeezing long ones, so the day's last events never fall off the grid.
 */
export function stackDenseBlocks(
  track: PositionedEvent[],
  dayStart: Date,
  dayEnd: Date,
  hourHeight: number,
): Map<string, EventBlockGeometry> {
  const geometries = new Map<string, EventBlockGeometry>();
  const placed: {
    positioned: PositionedEvent;
    top: number;
    bottom: number;
  }[] = [];

  const sharesWidth = (a: PositionedEvent, b: PositionedEvent) =>
    a.column / a.columns < (b.column + 1) / b.columns &&
    b.column / b.columns < (a.column + 1) / a.columns;

  // packOverlaps returns blocks in start-time order.
  for (const positioned of track) {
    const natural = geometryFor(positioned, dayStart, dayEnd, hourHeight, true);
    const top = placed.reduce(
      (lowest, above) =>
        sharesWidth(above.positioned, positioned)
          ? Math.max(lowest, above.bottom)
          : lowest,
      natural.top,
    );
    const bottom = Math.max(
      natural.top + natural.height,
      top + DENSE_MIN_BLOCK_HEIGHT,
    );

    placed.push({ positioned, top, bottom });
  }

  for (let index = placed.length - 1; index >= 0; index--) {
    const block = placed[index];
    const limit = placed
      .slice(index + 1)
      .reduce(
        (highest, below) =>
          sharesWidth(below.positioned, block.positioned)
            ? Math.min(highest, below.top)
            : highest,
        24 * hourHeight,
      );
    block.bottom = Math.min(block.bottom, limit);
    block.top = Math.min(block.top, block.bottom - DENSE_MIN_BLOCK_HEIGHT);

    const natural = geometryFor(
      block.positioned,
      dayStart,
      dayEnd,
      hourHeight,
      true,
    );
    geometries.set(block.positioned.event.id, {
      ...natural,
      top: block.top,
      height: block.bottom - block.top,
    });
  }

  return geometries;
}

type ResizeEdge = "top" | "bottom";

export function EventBlock({
  positioned,
  dayStart,
  dayEnd,
  hourHeight = HOUR_HEIGHT,
  dense = false,
  stackedGeometry,
  onSelect,
  onCommitTime,
}: {
  positioned: PositionedEvent;
  dayStart: Date;
  dayEnd: Date;
  /** Pixel height of one hour; the full-screen view shrinks it to fit. */
  hourHeight?: number;
  /** Full-screen grid: condensed titles that wrap to use the block's height. */
  dense?: boolean;
  /** Position from `stackDenseBlocks`, replacing the block's natural one. */
  stackedGeometry?: EventBlockGeometry;
  onSelect?: (event: TimeEvent) => void;
  /** Fired once a drag or resize ends, with the new times already snapped. */
  onCommitTime?: (event: TimeEvent, startTime: Date, endTime: Date) => void;
}) {
  const { event } = positioned;
  const geometry =
    stackedGeometry ??
    geometryFor(positioned, dayStart, dayEnd, hourHeight, dense);
  const pixelsPerMinute = hourHeight / 60;
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
        const offsetMinutes = snapToGrid(deltaY / pixelsPerMinute);
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
    [isInstance, event, onCommitTime, pixelsPerMinute],
  );

  // Live-preview geometry: resize offsets one edge only; drag translates the
  // whole block via a CSS transform (dnd-kit) rather than touching geometry.
  const previewTop =
    resize?.edge === "top" ? geometry.top + resize.offsetMinutes * pixelsPerMinute : geometry.top;
  const previewHeight =
    resize && resize.offsetMinutes !== 0
      ? Math.max(
          minBlockHeight(hourHeight, dense),
          resize.edge === "top"
            ? geometry.height - resize.offsetMinutes * pixelsPerMinute
            : geometry.height + resize.offsetMinutes * pixelsPerMinute,
        )
      : geometry.height;

  const compact = previewHeight < 34;
  // Whole lines only, so a block never shows half a line of text.
  const denseTitleLines = Math.max(
    1,
    Math.floor(previewHeight / DENSE_LINE_HEIGHT),
  );

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
          "group relative flex size-full flex-col overflow-hidden rounded-md text-left transition-shadow",
          dense
            ? "font-condensed rounded-sm px-px py-0 text-[10px] leading-[11px]"
            : "px-0.5 py-0.5 text-[10px] leading-tight sm:px-1.5 sm:text-xs",
          "hover:ring-ring/60 hover:ring-2 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          isPlanned
            ? cn(
                "text-foreground/90",
                // An outline takes no space, leaving a 12px block its full line.
                dense
                  ? "outline-1 -outline-offset-1 outline-dashed"
                  : "border border-dashed",
              )
            : "text-white shadow-sm",
          !isInstance && "touch-none",
          (isDragging || resize) && "opacity-80 shadow-lg",
        )}
        style={
          isPlanned
            ? {
                backgroundColor: withAlpha(event.category.color, 0.18),
                borderColor: event.category.color,
                outlineColor: event.category.color,
              }
            : { backgroundColor: event.category.color }
        }
      >
        {dense ? (
          // flex-none: a clipped flex item would otherwise collapse to nothing
          // in a short block, leaving plain colour with no title.
          <span
            className="flex-none overflow-hidden font-medium"
            style={{ maxHeight: denseTitleLines * DENSE_LINE_HEIGHT }}
          >
            {event.title}
          </span>
        ) : (
          <span className="truncate font-medium">{event.title}</span>
        )}
        {compact ? null : (
          <span className={cn("hidden truncate sm:block", isPlanned ? "text-muted-foreground" : "text-white/80")}>
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
