"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendar } from "@/store/use-calendar";
import { rangeForView } from "@/lib/time-utils";
import type { CalendarViewMode } from "@/types";

const VIEWS: CalendarViewMode[] = ["day", "week", "month", "year"];

function labelFor(anchor: Date, view: CalendarViewMode): string {
  if (view === "year") return format(anchor, "yyyy");
  if (view === "month") return format(anchor, "MMMM yyyy");
  if (view === "day") return format(anchor, "EEEE, d MMMM yyyy");

  const { start, end } = rangeForView(anchor, "week");
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, "d")}–${format(end, "d MMM yyyy")}`
    : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
}

export function CalendarToolbar({ onNewEvent }: { onNewEvent: () => void }) {
  const { anchor, view, filter, setView, setFilter, step, goToday } =
    useCalendar();
  const anchorDate = new Date(anchor);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h1 className="font-heading text-lg font-semibold">
          {labelFor(anchorDate, view)}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className="w-40" aria-label="Layer filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BOTH">Planned + Actual</SelectItem>
            <SelectItem value="PLANNED_ONLY">Planned only</SelectItem>
            <SelectItem value="ACTUAL_ONLY">Actual only</SelectItem>
          </SelectContent>
        </Select>

        <Tabs value={view} onValueChange={(value) => setView(value as CalendarViewMode)}>
          <TabsList>
            {VIEWS.map((mode) => (
              <TabsTrigger key={mode} value={mode} className="capitalize">
                {mode}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button onClick={onNewEvent}>
          <Plus className="size-4" />
          New event
        </Button>
      </div>
    </div>
  );
}
