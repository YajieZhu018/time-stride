import { z } from "zod";

/**
 * Shared between server actions (`safeParse`, returning the first issue's
 * message) and the client forms via `@hookform/resolvers`, so a rule is only
 * ever written once.
 */

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(40, "Name must be 40 characters or fewer"),
  color: z.string().regex(HEX_COLOR, "Color must be a hex code like #2563EB"),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const eventLayerSchema = z.enum(["PLANNED", "ACTUAL"]);
export const recurrenceFrequencySchema = z.enum([
  "ONCE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "CUSTOM",
]);

export const eventInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(120, "Title must be 120 characters or fewer"),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    categoryId: z.string().min(1, "Pick a category"),
    layer: eventLayerSchema,
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    frequency: recurrenceFrequencySchema.default("ONCE"),
    rruleString: z.string().trim().max(300).optional().or(z.literal("")),
    recurrenceEnd: z.coerce.date().optional().nullable(),
    linkedPlannedId: z.string().optional().or(z.literal("")),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  })
  .refine(
    (value) => value.frequency !== "CUSTOM" || Boolean(value.rruleString),
    {
      message: "A custom recurrence needs an RRULE string",
      path: ["rruleString"],
    },
  );

export type EventInput = z.input<typeof eventInputSchema>;

/** Moving or resizing a block on the grid. */
export const eventTimeUpdateSchema = z
  .object({
    id: z.string().min(1),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

/** Skipping or overriding one occurrence of a recurring series. */
export const occurrenceRefSchema = z.object({
  baseId: z.string().min(1),
  occurrenceStart: z.coerce.date(),
});

/** First validation issue, for the `{ error }` shape actions return. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
