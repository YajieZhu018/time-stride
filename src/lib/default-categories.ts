/**
 * The 11 default categories from spec.md. Seeded with `userId: null`, which the
 * schema defines as "global category" — visible to every user, editable by none.
 *
 * spec.md names these categories but never specifies their colours, so the hues
 * below were chosen to stay distinguishable from one another when rendered as
 * adjacent blocks on the calendar grid.
 */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  color: string;
  icon: string;
}> = [
  { name: "Work", color: "#2563EB", icon: "briefcase" },
  { name: "Study", color: "#7C3AED", icon: "book-open" },
  { name: "Health", color: "#10B981", icon: "heart-pulse" },
  { name: "Entertainment", color: "#F59E0B", icon: "clapperboard" },
  { name: "Chill", color: "#06B6D4", icon: "coffee" },
  { name: "Social", color: "#EC4899", icon: "users" },
  { name: "Sleep", color: "#6366F1", icon: "moon" },
  { name: "Household", color: "#84CC16", icon: "house" },
  { name: "Commute", color: "#F97316", icon: "car" },
  { name: "Side Projects", color: "#14B8A6", icon: "rocket" },
  { name: "Other", color: "#6B7280", icon: "circle-dashed" },
];
