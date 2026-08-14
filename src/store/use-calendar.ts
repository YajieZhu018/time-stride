"use client";

import { create } from "zustand";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  startOfDay,
} from "date-fns";
import type { CalendarViewMode, ViewFilterMode } from "@/types";

interface CalendarState {
  /** Anchor day for the current view, as epoch ms (serialisable, stable). */
  anchor: number;
  view: CalendarViewMode;
  filter: ViewFilterMode;
  /** Empty means "all categories". */
  categoryIds: string[];

  setAnchor: (date: Date) => void;
  setView: (view: CalendarViewMode) => void;
  setFilter: (filter: ViewFilterMode) => void;
  toggleCategory: (categoryId: string) => void;
  clearCategoryFilter: () => void;
  goToday: () => void;
  step: (direction: -1 | 1) => void;
}

/** Move by one unit of whatever view is showing. */
function shift(date: Date, view: CalendarViewMode, direction: -1 | 1): Date {
  switch (view) {
    case "day":
      return addDays(date, direction);
    case "week":
      return addWeeks(date, direction);
    case "month":
      return addMonths(date, direction);
    case "year":
      return addYears(date, direction);
  }
}

export const useCalendar = create<CalendarState>()((set, get) => ({
  anchor: startOfDay(new Date()).getTime(),
  view: "week",
  filter: "BOTH",
  categoryIds: [],

  setAnchor: (date) => set({ anchor: startOfDay(date).getTime() }),
  setView: (view) => set({ view }),
  setFilter: (filter) => set({ filter }),

  toggleCategory: (categoryId) =>
    set((state) => ({
      categoryIds: state.categoryIds.includes(categoryId)
        ? state.categoryIds.filter((id) => id !== categoryId)
        : [...state.categoryIds, categoryId],
    })),

  clearCategoryFilter: () => set({ categoryIds: [] }),
  goToday: () => set({ anchor: startOfDay(new Date()).getTime() }),

  step: (direction) => {
    const { anchor, view } = get();
    set({ anchor: shift(new Date(anchor), view, direction).getTime() });
  },
}));
