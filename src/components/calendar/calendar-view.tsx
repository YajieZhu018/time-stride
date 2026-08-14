"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { TimeGrid } from "@/components/calendar/time-grid";
import { MonthView } from "@/components/calendar/month-view";
import { YearHeatmap } from "@/components/calendar/year-heatmap";
import { EventDialog, type EventDraft } from "@/components/calendar/event-dialog";
import { useCalendar } from "@/store/use-calendar";
import { getEventsInRange, updateEventTime } from "@/app/actions/events";
import { daysInRange, rangeForView } from "@/lib/time-utils";
import type { Category, EventLayer, TimeEvent } from "@/types";

export function CalendarView({ categories }: { categories: Category[] }) {
  const { anchor, view, filter, categoryIds, setAnchor, setView } =
    useCalendar();
  const anchorDate = new Date(anchor);
  const range = rangeForView(anchorDate, view);
  const rangeStartMs = range.start.getTime();
  const rangeEndMs = range.end.getTime();

  const [events, setEvents] = useState<TimeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      <CalendarToolbar onNewEvent={openNewFromToolbar} />

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
