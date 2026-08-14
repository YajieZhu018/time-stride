"use client";

import { useRef, useState } from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Every 24h "HH:mm" on a 5-minute grid, e.g. "00:00", "00:05", … "23:55". */
const TIME_OPTIONS: string[] = Array.from({ length: 24 * 12 }, (_, index) => {
  const hours = Math.floor(index / 12);
  const minutes = (index % 12) * 5;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

/**
 * Accepts "9:30", "930", "0930", "9.30" — anything a user would plausibly
 * type without reaching for the dropdown — and normalises it to "HH:mm".
 * Returns null for anything that isn't a valid 24h time.
 */
function parseTime(input: string): string | null {
  const trimmed = input.trim();
  const match =
    trimmed.match(/^(\d{1,2}):(\d{2})$/) ??
    trimmed.match(/^(\d{1,2})\.(\d{2})$/) ??
    trimmed.match(/^(\d{1,2})(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * 24-hour time field: free typing (validated to "HH:mm" on blur/Enter) plus a
 * dropdown of 5-minute increments for picking without typing at all.
 */
export function TimeInput({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  /** Always "HH:mm", 24h. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  // Mirrors `value` so the render-time check below can tell "the dialog
  // reset defaults externally" apart from "the user is mid-keystroke" —
  // the standard React pattern for adjusting state from a prop change
  // without an effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [syncedValue, setSyncedValue] = useState(value);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  function commit(raw: string) {
    const parsed = parseTime(raw);
    if (parsed) {
      setDraft(parsed);
      if (parsed !== value) onChange(parsed);
    } else {
      // Not a real time — snap back rather than saving garbage.
      setDraft(value);
    }
  }

  function selectOption(option: string) {
    setDraft(option);
    onChange(option);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="HH:mm"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          }
        }}
        className="pr-8 font-mono"
      />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            requestAnimationFrame(() => {
              const parsed = parseTime(draft) ?? value;
              const target = listRef.current?.querySelector(
                `[data-time="${parsed}"]`,
              );
              target?.scrollIntoView({ block: "center" });
            });
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pick a time"
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Clock className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-28 p-1">
          <div ref={listRef} className="max-h-56 overflow-y-auto">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                data-time={option}
                onClick={() => selectOption(option)}
                className={cn(
                  "w-full rounded-md px-2 py-1 text-left font-mono text-sm hover:bg-accent",
                  option === value && "bg-accent font-medium",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
