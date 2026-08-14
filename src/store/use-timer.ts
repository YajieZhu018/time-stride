"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TimerData {
  /** Epoch ms when the current running segment began; null while paused. */
  segmentStartedAt: number | null;
  /** Milliseconds banked by segments completed before the current pause. */
  accumulatedMs: number;
  isRunning: boolean;
  categoryId: string | null;
  title: string;
  linkedPlannedId: string | null;
}

interface TimerActions {
  start: (options?: {
    categoryId?: string;
    title?: string;
    linkedPlannedId?: string | null;
  }) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setCategoryId: (categoryId: string) => void;
  setTitle: (title: string) => void;
  /** Pre-fill from a planned event without starting the clock. */
  prefill: (options: {
    categoryId: string;
    title: string;
    linkedPlannedId: string;
  }) => void;
}

export type TimerStore = TimerData & TimerActions;

const initialData: TimerData = {
  segmentStartedAt: null,
  accumulatedMs: 0,
  isRunning: false,
  categoryId: null,
  title: "",
  linkedPlannedId: null,
};

export const useTimer = create<TimerStore>()(
  persist(
    (set, get) => ({
      ...initialData,

      start: (options) =>
        set({
          segmentStartedAt: Date.now(),
          accumulatedMs: 0,
          isRunning: true,
          categoryId: options?.categoryId ?? get().categoryId,
          title: options?.title ?? get().title,
          linkedPlannedId:
            options?.linkedPlannedId ?? get().linkedPlannedId ?? null,
        }),

      pause: () => {
        const { isRunning, segmentStartedAt, accumulatedMs } = get();
        if (!isRunning || segmentStartedAt === null) return;
        set({
          isRunning: false,
          segmentStartedAt: null,
          accumulatedMs: accumulatedMs + (Date.now() - segmentStartedAt),
        });
      },

      resume: () => {
        if (get().isRunning) return;
        set({ isRunning: true, segmentStartedAt: Date.now() });
      },

      reset: () => set({ ...initialData }),

      setCategoryId: (categoryId) => set({ categoryId }),
      setTitle: (title) => set({ title }),
      prefill: ({ categoryId, title, linkedPlannedId }) =>
        set({ categoryId, title, linkedPlannedId }),
    }),
    {
      name: "timetrack-timer",
      // Persist only the data: a running timer survives a refresh because
      // `segmentStartedAt` is an absolute timestamp, so elapsed time is
      // recomputed from the wall clock rather than restored from a counter.
      partialize: (state): TimerData => ({
        segmentStartedAt: state.segmentStartedAt,
        accumulatedMs: state.accumulatedMs,
        isRunning: state.isRunning,
        categoryId: state.categoryId,
        title: state.title,
        linkedPlannedId: state.linkedPlannedId,
      }),
    },
  ),
);

/**
 * Elapsed milliseconds, always derived from timestamps.
 *
 * Never accumulate this with an interval: browsers throttle timers in
 * background tabs, so an incremented counter silently under-reports a timer
 * left running while the user works elsewhere — exactly when it matters.
 */
export function elapsedMs(state: TimerData, now: number): number {
  const current =
    state.isRunning && state.segmentStartedAt !== null
      ? now - state.segmentStartedAt
      : 0;
  return state.accumulatedMs + current;
}

export function formatStopwatch(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
