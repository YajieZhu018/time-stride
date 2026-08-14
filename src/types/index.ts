export type EventLayer = "PLANNED" | "ACTUAL";
export type CalendarViewMode = "day" | "week" | "month" | "year";
export type ViewFilterMode = "BOTH" | "PLANNED_ONLY" | "ACTUAL_ONLY";
export type RecurrenceFrequency =
  | "ONCE"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "CUSTOM";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isDefault: boolean;
  userId?: string;
}

export interface TimeEvent {
  id: string;
  userId: string;
  categoryId: string;
  category: Category;
  title: string;
  description?: string;
  layer: EventLayer;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  linkedPlannedId?: string;
  frequency: RecurrenceFrequency;
  rruleString?: string;
  recurrenceEnd?: Date;
  /** Occurrence start times of this event's own series to omit during expansion. */
  exDates?: Date[];
  /**
   * Set both on in-memory expanded instances and on persisted single-occurrence
   * overrides — in both cases it names the real base event's id. Use
   * `isSyntheticInstance` to tell the two apart: a synthetic instance has no
   * database row of its own (its `id` is `${baseId}::${isoDate}`) while an
   * override is a normal row identified by its own `id`.
   */
  parentEventId?: string;
  /** True only for in-memory occurrences expanded from a recurring base event. */
  isSyntheticInstance?: boolean;
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  color: string;
  plannedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number; // actual - planned
  variancePercentage: number;
}

export interface AnalyticsSummary {
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  adherenceScore: number; // 0 - 100
  breakdown: CategoryAnalytics[];
  insights: AnalyticsInsight[];
}

export interface AnalyticsInsight {
  categoryId: string;
  message: string;
  tone: "over" | "under" | "onTrack";
}

/** Uniform result shape returned by every server action. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };
