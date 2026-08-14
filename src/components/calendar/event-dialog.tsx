"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { addDays } from "date-fns";
import { Copy, Repeat, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createEvent,
  deleteEvent,
  skipOccurrence,
  updateEvent,
  updateOccurrence,
} from "@/app/actions/events";
import { useTimer } from "@/store/use-timer";
import {
  baseEventId,
  describeRecurrence,
  isRecurringInstance,
  isSyntheticInstance,
} from "@/lib/rrule-utils";
import {
  fromDateAndTimeInputs,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/time-utils";
import type {
  Category,
  EventLayer,
  RecurrenceFrequency,
  TimeEvent,
} from "@/types";

export interface EventDraft {
  event?: TimeEvent;
  start?: Date;
  end?: Date;
  layer?: EventLayer;
  linkedPlannedId?: string;
  title?: string;
  description?: string;
  categoryId?: string;
}

interface FormValues {
  title: string;
  description: string;
  categoryId: string;
  layer: EventLayer;
  date: string;
  start: string;
  end: string;
  frequency: RecurrenceFrequency;
  rruleString: string;
  recurrenceEnd: string;
}

type RepeatMode = "none" | "weekly-days" | "every-n-days" | "monthly" | "advanced";

const REPEAT_MODES: { value: RepeatMode; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly-days", label: "Weekly on selected days" },
  { value: "every-n-days", label: "Every few days" },
  { value: "monthly", label: "Monthly" },
  { value: "advanced", label: "Advanced (RRULE)" },
];

const WEEKDAYS = [
  { code: "MO", label: "Mon", jsDay: 1 },
  { code: "TU", label: "Tue", jsDay: 2 },
  { code: "WE", label: "Wed", jsDay: 3 },
  { code: "TH", label: "Thu", jsDay: 4 },
  { code: "FR", label: "Fri", jsDay: 5 },
  { code: "SA", label: "Sat", jsDay: 6 },
  { code: "SU", label: "Sun", jsDay: 0 },
] as const;

function buildWeeklyRrule(days: Set<string>): string {
  return days.size > 0 ? `FREQ=WEEKLY;BYDAY=${[...days].join(",")}` : "";
}

function buildDailyRrule(interval: number): string {
  return interval > 1 ? `FREQ=DAILY;INTERVAL=${interval}` : "";
}

/**
 * Reverse-maps a stored frequency/rruleString back onto the friendly picker.
 * Only rules built purely from FREQ/BYDAY/INTERVAL round-trip onto the
 * picker; anything richer (COUNT, BYMONTHDAY, ...) falls back to the
 * Advanced textbox rather than silently losing data on the next save.
 */
function parseRepeatState(
  frequency: RecurrenceFrequency,
  rruleString: string,
  startDate: Date,
): { mode: RepeatMode; days: Set<string>; interval: number } {
  if (frequency === "ONCE") return { mode: "none", days: new Set(), interval: 1 };

  const freqMatch = rruleString.match(/FREQ=(\w+)/);
  const byDayMatch = rruleString.match(/BYDAY=([A-Z,]+)/);
  const intervalMatch = rruleString.match(/INTERVAL=(\d+)/);
  const effectiveFreq = freqMatch?.[1] ?? frequency;

  const knownKeys = new Set(["FREQ", "BYDAY", "INTERVAL"]);
  const isSimpleRule =
    !rruleString ||
    rruleString.split(";").every((part) => knownKeys.has(part.split("=")[0]));

  if (isSimpleRule && effectiveFreq === "WEEKLY") {
    const days = byDayMatch
      ? new Set(byDayMatch[1].split(","))
      : new Set([
          WEEKDAYS.find((day) => day.jsDay === startDate.getDay())?.code ?? "MO",
        ]);
    return { mode: "weekly-days", days, interval: 1 };
  }

  if (isSimpleRule && effectiveFreq === "DAILY") {
    return {
      mode: "every-n-days",
      days: new Set(),
      interval: intervalMatch ? Number(intervalMatch[1]) : 1,
    };
  }

  if (isSimpleRule && effectiveFreq === "MONTHLY" && !rruleString) {
    return { mode: "monthly", days: new Set(), interval: 1 };
  }

  return { mode: "advanced", days: new Set(), interval: 1 };
}

function defaultsFor(draft: EventDraft | null, fallbackCategoryId: string): FormValues {
  const event = draft?.event;
  const start = event?.startTime ?? draft?.start ?? new Date();
  const end = event?.endTime ?? draft?.end ?? new Date(start.getTime() + 60 * 60_000);

  return {
    title: event?.title ?? draft?.title ?? "",
    description: event?.description ?? draft?.description ?? "",
    categoryId: event?.categoryId ?? draft?.categoryId ?? fallbackCategoryId,
    layer: event?.layer ?? draft?.layer ?? "PLANNED",
    date: toDateInputValue(start),
    start: toTimeInputValue(start),
    end: toTimeInputValue(end),
    frequency: event?.frequency ?? "ONCE",
    rruleString: event?.rruleString ?? "",
    recurrenceEnd: event?.recurrenceEnd
      ? toDateInputValue(event.recurrenceEnd)
      : "",
  };
}

export function EventDialog({
  open,
  onOpenChange,
  draft,
  categories,
  onSaved,
  onLogActual,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: EventDraft | null;
  categories: Category[];
  onSaved: () => void;
  /** Reopen the dialog pre-filled as an ACTUAL copy of a planned event. */
  onLogActual?: (draft: EventDraft) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const startTimer = useTimer((state) => state.start);

  const existing = draft?.event;
  // A synthetic instance has no database row of its own — editing/deleting it
  // needs an explicit "this occurrence" vs "entire series" choice. A
  // persisted override (already its own row) never needs that choice.
  const editingInstance = existing ? isSyntheticInstance(existing) : false;
  const editingOverride = existing
    ? isRecurringInstance(existing) && !editingInstance
    : false;

  const [scope, setScope] = useState<"occurrence" | "series">("occurrence");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [intervalDays, setIntervalDays] = useState(2);

  const form = useForm<FormValues>({
    defaultValues: defaultsFor(draft, categories[0]?.id ?? ""),
  });

  useEffect(() => {
    if (!open) return;
    const values = defaultsFor(draft, categories[0]?.id ?? "");
    form.reset(values);

    const startDate = fromDateAndTimeInputs(values.date, values.start);
    const repeat = parseRepeatState(values.frequency, values.rruleString, startDate);
    setRepeatMode(repeat.mode);
    setSelectedDays(repeat.days);
    setIntervalDays(repeat.interval);
    setScope("occurrence");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, categories]);

  const layer = form.watch("layer");
  const frequency = form.watch("frequency");
  const rruleString = form.watch("rruleString");
  const recurrencePreview = describeRecurrence({ frequency, rruleString });

  const occurrenceScoped = Boolean(existing && editingInstance && scope === "occurrence");

  function applyRepeatMode(mode: RepeatMode) {
    setRepeatMode(mode);
    if (mode === "none") {
      form.setValue("frequency", "ONCE");
      form.setValue("rruleString", "");
    } else if (mode === "weekly-days") {
      const days =
        selectedDays.size > 0
          ? selectedDays
          : new Set([
              WEEKDAYS.find(
                (day) =>
                  day.jsDay ===
                  fromDateAndTimeInputs(form.getValues("date"), form.getValues("start")).getDay(),
              )?.code ?? "MO",
            ]);
      setSelectedDays(days);
      form.setValue("frequency", "WEEKLY");
      form.setValue("rruleString", buildWeeklyRrule(days));
    } else if (mode === "every-n-days") {
      form.setValue("frequency", "DAILY");
      form.setValue("rruleString", buildDailyRrule(intervalDays));
    } else if (mode === "monthly") {
      form.setValue("frequency", "MONTHLY");
      form.setValue("rruleString", "");
    } else {
      form.setValue("frequency", "CUSTOM");
    }
  }

  function toggleDay(code: string) {
    const next = new Set(selectedDays);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedDays(next);
    form.setValue("rruleString", buildWeeklyRrule(next));
  }

  function changeInterval(value: number) {
    const clamped = Math.max(1, Math.min(365, Math.round(value) || 1));
    setIntervalDays(clamped);
    form.setValue("rruleString", buildDailyRrule(clamped));
  }

  function onSubmit(values: FormValues) {
    if (repeatMode === "weekly-days" && selectedDays.size === 0) {
      toast.error("Pick at least one day to repeat on");
      return;
    }

    const startTime = fromDateAndTimeInputs(values.date, values.start);
    let endTime = fromDateAndTimeInputs(values.date, values.end);

    // An end earlier than the start means the block runs past midnight —
    // a sleep or night-shift entry — rather than being invalid.
    if (endTime <= startTime) endTime = addDays(endTime, 1);

    const payload = {
      title: values.title,
      description: values.description,
      categoryId: values.categoryId,
      layer: values.layer,
      startTime,
      endTime,
      frequency: occurrenceScoped ? "ONCE" : values.frequency,
      rruleString:
        !occurrenceScoped && values.frequency === "CUSTOM" ? values.rruleString : "",
      recurrenceEnd: occurrenceScoped
        ? null
        : values.recurrenceEnd
          ? fromDateAndTimeInputs(values.recurrenceEnd, "23:59")
          : null,
      linkedPlannedId: existing?.linkedPlannedId ?? draft?.linkedPlannedId ?? "",
    };

    startTransition(async () => {
      const result = occurrenceScoped
        ? await updateOccurrence(
            { baseId: baseEventId(existing!), occurrenceStart: existing!.startTime },
            payload,
          )
        : existing
          ? await updateEvent(baseEventId(existing), payload)
          : await createEvent(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        existing ? (occurrenceScoped ? "Occurrence updated" : "Event updated") : "Event created",
      );
      onOpenChange(false);
      onSaved();
      router.refresh();
    });
  }

  function handleStartTimer() {
    if (!existing) return;
    startTimer({
      categoryId: existing.categoryId,
      title: existing.title,
      linkedPlannedId: baseEventId(existing),
    });
    toast.success("Timer started — Stop & Save when you're done");
    onOpenChange(false);
  }

  /** Reopen pre-filled as a directly-editable ACTUAL copy of this planned entry. */
  function handleLogActualEntry() {
    if (!existing) return;
    onLogActual?.({
      start: existing.startTime,
      end: existing.endTime,
      layer: "ACTUAL",
      categoryId: existing.categoryId,
      title: existing.title,
      description: existing.description,
      linkedPlannedId: baseEventId(existing),
    });
  }

  function handleDelete() {
    if (!existing) return;
    startTransition(async () => {
      const result = occurrenceScoped
        ? await skipOccurrence({
            baseId: baseEventId(existing),
            occurrenceStart: existing.startTime,
          })
        : await deleteEvent(baseEventId(existing));

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(occurrenceScoped ? "Occurrence skipped" : "Event deleted");
      onOpenChange(false);
      onSaved();
      router.refresh();
    });
  }

  const deleteLabel = occurrenceScoped
    ? "Skip occurrence"
    : editingInstance
      ? "Delete series"
      : "Delete";
  const saveLabel = existing
    ? occurrenceScoped
      ? "Save this occurrence"
      : "Save changes"
    : "Create event";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            Planned events are what you intend to do; actual events are what
            happened. Analytics compares the two.
          </DialogDescription>
        </DialogHeader>

        {editingInstance ? (
          <div className="space-y-2">
            <Alert>
              <Repeat className="size-4" />
              <AlertDescription>
                This is one occurrence of a repeating event. Choose what your
                changes apply to.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={scope === "occurrence" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setScope("occurrence")}
              >
                Just this occurrence
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scope === "series" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setScope("series")}
              >
                Entire series
              </Button>
            </div>
          </div>
        ) : editingOverride ? (
          <Alert>
            <Repeat className="size-4" />
            <AlertDescription>
              This occurrence was already modified separately — changes here
              affect only this date, not the rest of the series.
            </AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Tabs
            value={layer}
            onValueChange={(value) => form.setValue("layer", value as EventLayer)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="PLANNED" className="flex-1">
                Planned
              </TabsTrigger>
              <TabsTrigger value="ACTUAL" className="flex-1">
                Actual
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              {...form.register("title", { required: true })}
              placeholder="e.g. Deep work on TimeTrack"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-category">Category</Label>
            <Select
              value={form.watch("categoryId")}
              onValueChange={(value) => form.setValue("categoryId", value)}
            >
              <SelectTrigger id="event-category" className="w-full">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="event-date">Date</Label>
              <Input id="event-date" type="date" {...form.register("date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-start">Start</Label>
              <TimeInput
                id="event-start"
                value={form.watch("start")}
                onChange={(value) => form.setValue("start", value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">End</Label>
              <TimeInput
                id="event-end"
                value={form.watch("end")}
                onChange={(value) => form.setValue("end", value)}
              />
            </div>
          </div>

          {occurrenceScoped ? null : (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="event-repeat-mode">Repeats</Label>
                <Select
                  value={repeatMode}
                  onValueChange={(value) => applyRepeatMode(value as RepeatMode)}
                >
                  <SelectTrigger id="event-repeat-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_MODES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {repeatMode === "weekly-days" ? (
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.code}
                      type="button"
                      onClick={() => toggleDay(day.code)}
                      aria-pressed={selectedDays.has(day.code)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                        selectedDays.has(day.code)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {day.label[0]}
                    </button>
                  ))}
                </div>
              ) : null}

              {repeatMode === "every-n-days" ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={intervalDays}
                    onChange={(event) => changeInterval(Number(event.target.value))}
                    className="w-16"
                  />
                  <span className="text-muted-foreground">
                    day{intervalDays === 1 ? "" : "s"}
                  </span>
                </div>
              ) : null}

              {repeatMode === "advanced" ? (
                <div className="space-y-2">
                  <Label htmlFor="event-rrule">RRULE</Label>
                  <Input
                    id="event-rrule"
                    placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                    className="font-mono"
                    {...form.register("rruleString")}
                  />
                </div>
              ) : null}

              {repeatMode !== "none" ? (
                <>
                  {recurrencePreview ? (
                    <p className="text-xs text-muted-foreground">
                      Repeats: {recurrencePreview}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="event-recurrence-end">
                      Repeat until (optional)
                    </Label>
                    <Input
                      id="event-recurrence-end"
                      type="date"
                      {...form.register("recurrenceEnd")}
                    />
                  </div>
                </>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="event-description">Notes</Label>
            <Textarea
              id="event-description"
              rows={2}
              {...form.register("description")}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {existing ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  <Trash2 className="size-4" />
                  {deleteLabel}
                </Button>
                {existing.layer === "PLANNED" ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleLogActualEntry}
                    >
                      <Copy className="size-4" />
                      Log Actual Time
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleStartTimer}
                    >
                      <Timer className="size-4" />
                      Start Timer
                    </Button>
                  </>
                ) : null}
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {saveLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
