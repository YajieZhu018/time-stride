"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { toTimeEvent } from "@/lib/serialize";
import {
  eventInputSchema,
  eventTimeUpdateSchema,
  occurrenceRefSchema,
  firstIssue,
} from "@/lib/validation";
import { durationMinutes } from "@/lib/time-utils";
import { expandEvents } from "@/lib/rrule-utils";
import type { ActionResult, TimeEvent } from "@/types";

function revalidateEventViews() {
  revalidatePath("/calendar");
  revalidatePath("/analytics");
}

/**
 * Everything visible in [start, end]: one-off events overlapping the window,
 * plus every recurring base event, which is then expanded in memory.
 *
 * Recurring instances are never written to the database (spec.md §5.1) — a
 * daily event would otherwise generate a row per day forever.
 */
export async function getEventsInRange(
  start: Date,
  end: Date,
): Promise<TimeEvent[]> {
  const userId = await getCurrentUserId();

  const rows = await prisma.timeEvent.findMany({
    where: {
      userId,
      OR: [
        // Non-recurring events that overlap the window.
        {
          frequency: "ONCE",
          startTime: { lt: end },
          endTime: { gt: start },
        },
        // Recurring bases: fetched whole, filtered during expansion.
        {
          frequency: { not: "ONCE" },
          startTime: { lt: end },
          OR: [{ recurrenceEnd: null }, { recurrenceEnd: { gt: start } }],
        },
      ],
    },
    include: { category: true },
    orderBy: { startTime: "asc" },
  });

  return expandEvents(rows.map(toTimeEvent), { start, end });
}

export async function createEvent(
  input: unknown,
): Promise<ActionResult<TimeEvent>> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const userId = await getCurrentUserId();
    const data = parsed.data;

    const event = await prisma.timeEvent.create({
      data: {
        userId,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description || null,
        layer: data.layer,
        startTime: data.startTime,
        endTime: data.endTime,
        // Derived server-side rather than trusted from the client, so the
        // stored minutes can never disagree with the timestamps.
        duration: durationMinutes(data.startTime, data.endTime),
        frequency: data.frequency,
        rruleString: data.rruleString || null,
        recurrenceEnd: data.recurrenceEnd ?? null,
        linkedPlannedId: data.linkedPlannedId || null,
      },
      include: { category: true },
    });

    revalidateEventViews();
    return { ok: true, data: toTimeEvent(event) };
  } catch (error) {
    console.error("[actions/events] create failed:", error);
    return { ok: false, error: "Could not save the event" };
  }
}

export async function updateEvent(
  id: string,
  input: unknown,
): Promise<ActionResult<TimeEvent>> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const userId = await getCurrentUserId();
    const data = parsed.data;

    const existing = await prisma.timeEvent.findFirst({
      where: { id, userId },
    });
    if (!existing) return { ok: false, error: "Event not found" };

    const event = await prisma.timeEvent.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        title: data.title,
        description: data.description || null,
        layer: data.layer,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: durationMinutes(data.startTime, data.endTime),
        frequency: data.frequency,
        rruleString: data.rruleString || null,
        recurrenceEnd: data.recurrenceEnd ?? null,
        linkedPlannedId: data.linkedPlannedId || null,
      },
      include: { category: true },
    });

    revalidateEventViews();
    return { ok: true, data: toTimeEvent(event) };
  } catch (error) {
    console.error("[actions/events] update failed:", error);
    return { ok: false, error: "Could not update the event" };
  }
}

/** Move or resize on the grid: timestamps only, everything else untouched. */
export async function updateEventTime(
  input: unknown,
): Promise<ActionResult<TimeEvent>> {
  const parsed = eventTimeUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const userId = await getCurrentUserId();
    const { id, startTime, endTime } = parsed.data;

    const existing = await prisma.timeEvent.findFirst({
      where: { id, userId },
    });
    if (!existing) return { ok: false, error: "Event not found" };

    const event = await prisma.timeEvent.update({
      where: { id },
      data: {
        startTime,
        endTime,
        duration: durationMinutes(startTime, endTime),
      },
      include: { category: true },
    });

    revalidateEventViews();
    return { ok: true, data: toTimeEvent(event) };
  } catch (error) {
    console.error("[actions/events] time update failed:", error);
    return { ok: false, error: "Could not move the event" };
  }
}

/**
 * Skip one occurrence of a recurring series without touching the rest: the
 * occurrence's start time is recorded on the base event's `exDates`, so
 * `expandEvents` omits it from every future render while every other
 * occurrence (past and future) is untouched.
 */
export async function skipOccurrence(input: unknown): Promise<ActionResult> {
  const parsed = occurrenceRefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const userId = await getCurrentUserId();
    const { baseId, occurrenceStart } = parsed.data;

    const base = await prisma.timeEvent.findFirst({
      where: { id: baseId, userId },
    });
    if (!base) return { ok: false, error: "Event not found" };

    await prisma.timeEvent.update({
      where: { id: baseId },
      data: { exDates: { push: occurrenceStart } },
    });

    revalidateEventViews();
    return { ok: true, data: null };
  } catch (error) {
    console.error("[actions/events] skip occurrence failed:", error);
    return { ok: false, error: "Could not skip this occurrence" };
  }
}

/**
 * Replace one occurrence of a recurring series with its own standalone row,
 * so edits to its time/title/category never ripple onto other occurrences.
 * The original occurrence is excluded via `exDates` in the same transaction
 * that creates the override, so the series never briefly shows both.
 */
export async function updateOccurrence(
  occurrenceRef: unknown,
  input: unknown,
): Promise<ActionResult<TimeEvent>> {
  const parsedRef = occurrenceRefSchema.safeParse(occurrenceRef);
  if (!parsedRef.success) return { ok: false, error: firstIssue(parsedRef.error) };

  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const userId = await getCurrentUserId();
    const { baseId, occurrenceStart } = parsedRef.data;
    const data = parsed.data;

    const base = await prisma.timeEvent.findFirst({
      where: { id: baseId, userId },
    });
    if (!base) return { ok: false, error: "Event not found" };

    const [, override] = await prisma.$transaction([
      prisma.timeEvent.update({
        where: { id: baseId },
        data: { exDates: { push: occurrenceStart } },
      }),
      prisma.timeEvent.create({
        data: {
          userId,
          categoryId: data.categoryId,
          title: data.title,
          description: data.description || null,
          layer: data.layer,
          startTime: data.startTime,
          endTime: data.endTime,
          duration: durationMinutes(data.startTime, data.endTime),
          frequency: "ONCE",
          linkedPlannedId: data.linkedPlannedId || null,
          parentEventId: baseId,
        },
        include: { category: true },
      }),
    ]);

    revalidateEventViews();
    return { ok: true, data: toTimeEvent(override) };
  } catch (error) {
    console.error("[actions/events] update occurrence failed:", error);
    return { ok: false, error: "Could not update this occurrence" };
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const existing = await prisma.timeEvent.findFirst({ where: { id, userId } });
    if (!existing) return { ok: false, error: "Event not found" };

    await prisma.timeEvent.delete({ where: { id } });

    revalidateEventViews();
    return { ok: true, data: null };
  } catch (error) {
    console.error("[actions/events] delete failed:", error);
    return { ok: false, error: "Could not delete the event" };
  }
}

/**
 * Commit a finished stopwatch run as an ACTUAL event.
 *
 * The block is anchored to the stop time and extends backwards by the tracked
 * duration, so paused minutes are excluded and `duration` always equals
 * `endTime - startTime` rather than silently disagreeing with it.
 */
export async function saveTimerEvent(input: {
  categoryId: string;
  title: string;
  trackedMinutes: number;
  linkedPlannedId?: string | null;
}): Promise<ActionResult<TimeEvent>> {
  const minutes = Math.max(1, Math.round(input.trackedMinutes));
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - minutes * 60_000);

  return createEvent({
    categoryId: input.categoryId,
    title: input.title.trim() || "Untitled",
    layer: "ACTUAL",
    startTime,
    endTime,
    frequency: "ONCE",
    linkedPlannedId: input.linkedPlannedId ?? "",
  });
}

/** Planned events on a given day, to offer as link targets for an actual log. */
export async function listPlannedEventsForDay(day: Date): Promise<TimeEvent[]> {
  const userId = await getCurrentUserId();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const rows = await prisma.timeEvent.findMany({
    where: {
      userId,
      layer: "PLANNED",
      startTime: { lt: end },
      endTime: { gt: start },
    },
    include: { category: true },
    orderBy: { startTime: "asc" },
  });

  return rows.map(toTimeEvent);
}
