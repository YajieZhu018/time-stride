"use client";

import { useEffect, useState, useTransition } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useRouter } from "next/navigation";
import { Link2, Pause, Play, Save, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveTimerEvent } from "@/app/actions/events";
import { elapsedMs, formatStopwatch, useTimer } from "@/store/use-timer";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export function TimerWidget({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Zustand's persisted state only exists after hydration; rendering it on the
  // first client pass would not match the server's HTML.
  const mounted = useHydrated();

  const timer = useTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.isRunning]);

  const totalMs = mounted ? elapsedMs(timer, now) : 0;
  const hasRun = totalMs > 0 || timer.isRunning;
  const selectedCategory = categories.find((c) => c.id === timer.categoryId);

  function handleStart() {
    if (!timer.categoryId) {
      toast.error("Pick a category before starting the timer");
      return;
    }
    setNow(Date.now());
    if (totalMs > 0) timer.resume();
    else timer.start();
  }

  function handleStopAndSave() {
    if (!timer.categoryId) {
      toast.error("Pick a category before saving");
      return;
    }

    const trackedMinutes = elapsedMs(timer, Date.now()) / 60_000;
    if (trackedMinutes < 1) {
      toast.error("Track at least a minute before saving");
      return;
    }

    startTransition(async () => {
      const result = await saveTimerEvent({
        categoryId: timer.categoryId!,
        title: timer.title,
        trackedMinutes,
        linkedPlannedId: timer.linkedPlannedId,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      timer.reset();
      toast.success(`Logged ${Math.round(trackedMinutes)} min of ${result.data.category.name}`);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div
          className={cn(
            "font-mono text-2xl tabular-nums transition-colors",
            timer.isRunning ? "text-foreground" : "text-muted-foreground",
          )}
          aria-live="off"
        >
          {formatStopwatch(totalMs)}
        </div>

        {selectedCategory ? (
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: selectedCategory.color }}
            aria-hidden
          />
        ) : null}

        <Select
          value={timer.categoryId ?? undefined}
          onValueChange={timer.setCategoryId}
        >
          <SelectTrigger className="w-44" aria-label="Timer category">
            <SelectValue placeholder="Category" />
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

        <Input
          value={timer.title}
          onChange={(event) => timer.setTitle(event.target.value)}
          placeholder="What are you working on?"
          className="min-w-40 flex-1"
          aria-label="Timer title"
        />

        {mounted && timer.linkedPlannedId ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Link2 className="size-3.5" />
            linked to plan
          </span>
        ) : null}

        <div className="flex items-center gap-2">
          {timer.isRunning ? (
            <Button variant="secondary" onClick={timer.pause}>
              <Pause className="size-4" />
              Pause
            </Button>
          ) : (
            <Button onClick={handleStart}>
              <Play className="size-4" />
              {totalMs > 0 ? "Resume" : "Start"}
            </Button>
          )}

          <Button
            variant="default"
            onClick={handleStopAndSave}
            disabled={!hasRun || isPending}
          >
            <Save className="size-4" />
            Stop &amp; Save
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={timer.reset}
            disabled={!hasRun || isPending}
            aria-label="Discard timer"
            title="Discard"
          >
            <Square className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
