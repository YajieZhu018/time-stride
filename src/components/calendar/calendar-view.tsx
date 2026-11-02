"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Minimize2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { TimeGrid } from "@/components/calendar/time-grid";
import { MonthView } from "@/components/calendar/month-view";
import { YearHeatmap } from "@/components/calendar/year-heatmap";
import { EventDialog, type EventDraft } from "@/components/calendar/event-dialog";
import { useCalendar } from "@/store/use-calendar";
import { getEventsInRange, updateEventTime } from "@/app/actions/events";
import { daysInRange, rangeForView } from "@/lib/time-utils";
import { format } from "date-fns";
import type { Category, EventLayer, TimeEvent } from "@/types";

export function CalendarView({ categories }: { categories: Category[] }) {
  const { anchor, view, filter, categoryIds, setAnchor, setView } =
    useCalendar();
  const anchorDate = new Date(anchor);
  const range = rangeForView(anchorDate, view);
  const rangeStartMs = range.start.getTime();
  const rangeEndMs = range.end.getTime();

  // Seven days × two tracks can't fit a phone; open on the day view there.
  // Runs once, so switching to week afterwards still sticks.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setView("day");
  }, [setView]);

  const [events, setEvents] = useState<TimeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getEventsInRange(new Date(rangeStartMs), new Date(rangeEndMs));
      setEvents(data);
    } finally {
      setIsLoading(false);
    }
  }, [rangeStartMs, rangeEndMs]);

  useEffect(() => {
    // `load` only sets state after its await, so nothing runs synchronously
    // here — the lint rule can't see past the await, hence the disable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const visibleEvents =
    categoryIds.length === 0
      ? events
      : events.filter((event) => categoryIds.includes(event.categoryId));

  // Best effort: real browser fullscreen + landscape where the device allows
  // it (Android Chrome); the fixed overlay below works regardless (iOS Safari).
  function enterFullscreen() {
    setFullscreen(true);
    document.documentElement.requestFullscreen?.().then(
      // `lock` isn't in TypeScript's DOM typings yet.
      () =>
        (screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        })
          .lock?.("landscape")
          .catch(() => {}),
      () => {},
    );
  }

  function exitFullscreen() {
    setFullscreen(false);
    screen.orientation?.unlock?.();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // Leaving browser fullscreen with the system gesture / Esc closes the overlay.
  useEffect(() => {
    if (!fullscreen) return;
    function onChange() {
      if (!document.fullscreenElement) setFullscreen(false);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [fullscreen]);

  function openCreate(start: Date, layer: EventLayer) {
    setDraft({ start, layer });
    setDialogOpen(true);
  }

  function openEdit(event: TimeEvent) {
    setDraft({ event });
    setDialogOpen(true);
  }

  function openNewFromToolbar() {
    setDraft({ start: anchorDate, layer: "PLANNED" });
    setDialogOpen(true);
  }

  function jumpToDay(day: Date) {
    setAnchor(day);
    setView("day");
  }

  /**
   * Drag-to-move / resize-handle commit. Applied optimistically — the block
   * needs to land in its new place the instant the pointer releases — and
   * rolled back to the pre-drag snapshot if the server rejects it.
   */
  function commitTime(event: TimeEvent, startTime: Date, endTime: Date) {
    const previous = events;
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, startTime, endTime } : item,
      ),
    );

    updateEventTime({ id: event.id, startTime, endTime }).then((result) => {
      if (!result.ok) {
        setEvents(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <CalendarToolbar
        onNewEvent={openNewFromToolbar}
        onFullscreen={enterFullscreen}
      />

      {isLoading ? (
        <div className="text-muted-foreground py-16 text-center text-sm">
          Loading…
        </div>
      ) : view === "month" ? (
        <MonthView
          days={daysInRange(range)}
          monthAnchor={anchorDate}
          events={visibleEvents}
          onSelectDay={jumpToDay}
          onSelectEvent={openEdit}
        />
      ) : view === "year" ? (
        <YearHeatmap
          year={anchorDate.getFullYear()}
          events={visibleEvents}
          onSelectDay={jumpToDay}
        />
      ) : (
        <TimeGrid
          days={view === "day" ? [anchorDate] : daysInRange(range)}
          events={visibleEvents}
          filter={filter}
          onSelectEvent={openEdit}
          onCreateAt={openCreate}
          onCommitTime={commitTime}
        />
      )}

      {/* Portalled to <body> so it sits above the fixed timer bar. */}
      {fullscreen && (view === "day" || view === "week")
        ? createPortal(
            <div className="bg-background fixed inset-0 z-50 flex flex-col gap-1 p-2">
              <div className="flex items-center justify-between">
                <span className="font-heading text-sm font-semibold">
                  {view === "day"
                    ? format(anchorDate, "EEEE, d MMMM yyyy")
                    : `${format(range.start, "d MMM")} – ${format(range.end, "d MMM yyyy")}`}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Exit full screen"
                  onClick={exitFullscreen}
                >
                  <Minimize2 className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <TimeGrid
                  fit
                  days={view === "day" ? [anchorDate] : daysInRange(range)}
                  events={visibleEvents}
                  filter={filter}
                  onSelectEvent={openEdit}
                  onCreateAt={openCreate}
                  onCommitTime={commitTime}
                />
              </div>
            </div>,
            document.body,
          )
        : null}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        categories={categories}
        onSaved={load}
        onLogActual={setDraft}
      />
    </div>
  );
}
