import type {
  Category as PrismaCategory,
  TimeEvent as PrismaTimeEvent,
} from "@prisma/client";
import type { Category, TimeEvent } from "@/types";

/**
 * Prisma models use `null` for absent values; the shared interfaces in
 * `@/types` use optional properties. These adapters are the single place that
 * gap is bridged, so no component ever has to handle both shapes.
 */
export function toCategory(category: PrismaCategory): Category {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon ?? undefined,
    isDefault: category.isDefault,
    userId: category.userId ?? undefined,
  };
}

export function toTimeEvent(
  event: PrismaTimeEvent & { category: PrismaCategory },
): TimeEvent {
  return {
    id: event.id,
    userId: event.userId,
    categoryId: event.categoryId,
    category: toCategory(event.category),
    title: event.title,
    description: event.description ?? undefined,
    layer: event.layer,
    startTime: event.startTime,
    endTime: event.endTime,
    duration: event.duration,
    linkedPlannedId: event.linkedPlannedId ?? undefined,
    frequency: event.frequency,
    rruleString: event.rruleString ?? undefined,
    recurrenceEnd: event.recurrenceEnd ?? undefined,
    exDates: event.exDates,
    parentEventId: event.parentEventId ?? undefined,
  };
}
