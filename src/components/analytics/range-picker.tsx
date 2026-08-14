"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toDateInputValue, WEEK_OPTIONS, type DateRange } from "@/lib/time-utils";

export type RangePreset = "week" | "month" | "custom";

function presetRange(preset: RangePreset, custom: DateRange): DateRange {
  const now = new Date();
  if (preset === "week") {
    return { start: startOfWeek(now, WEEK_OPTIONS), end: endOfWeek(now, WEEK_OPTIONS) };
  }
  if (preset === "month") {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }
  return custom;
}

export function RangePicker({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [preset, setPreset] = useState<RangePreset>("week");
  const [open, setOpen] = useState(false);

  function selectPreset(next: RangePreset) {
    setPreset(next);
    if (next !== "custom") onChange(presetRange(next, range));
    else setOpen(true);
  }

  return (
    <div className="flex items-center gap-2">
      {(["week", "month", "custom"] as RangePreset[]).map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={preset === option ? "default" : "outline"}
          className="capitalize"
          onClick={() => selectPreset(option)}
        >
          {option === "week" ? "This week" : option === "month" ? "This month" : "Custom"}
        </Button>
      ))}

      {preset === "custom" ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {format(range.start, "d MMM")} – {format(range.end, "d MMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex gap-3 p-4" align="end">
            <div className="space-y-1.5">
              <Label htmlFor="range-start">From</Label>
              <Input
                id="range-start"
                type="date"
                value={toDateInputValue(range.start)}
                onChange={(event) => {
                  const [y, m, d] = event.target.value.split("-").map(Number);
                  onChange({ ...range, start: new Date(y, m - 1, d) });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="range-end">To</Label>
              <Input
                id="range-end"
                type="date"
                value={toDateInputValue(range.end)}
                onChange={(event) => {
                  const [y, m, d] = event.target.value.split("-").map(Number);
                  onChange({ ...range, end: new Date(y, m - 1, d, 23, 59, 59) });
                }}
              />
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
