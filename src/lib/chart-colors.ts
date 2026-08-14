/**
 * Category identity already has a color: the hex the user picked when
 * creating the category, reused on every calendar block. Charts read that
 * same field rather than generating a fresh categorical palette, so a
 * category looks identical wherever it appears in the app.
 *
 * The one palette owned by the charts is the diverging pair for variance
 * (actual − planned): a polarity, not an identity, so it is deliberately
 * distinct from category colors. Defined as CSS variables in globals.css
 * (validated blue/red diverging pair) so light/dark swap in one place.
 */
export const VARIANCE_OVER = "var(--variance-over)";
export const VARIANCE_UNDER = "var(--variance-under)";

export const CHART_GRID = "var(--border)";
export const CHART_AXIS_INK = "var(--muted-foreground)";

/** Past this many slices a donut gets unreadable; roll the tail into "Other". */
export const MAX_DONUT_SLICES = 6;
export const OTHER_SLICE_COLOR = "var(--muted-foreground)";

export interface Slice {
  name: string;
  value: number;
  color: string;
}

export function foldTail(slices: Slice[], max = MAX_DONUT_SLICES): Slice[] {
  if (slices.length <= max) return slices;

  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, max - 1);
  const tail = sorted.slice(max - 1);
  const otherValue = tail.reduce((sum, slice) => sum + slice.value, 0);

  return otherValue > 0
    ? [...head, { name: "Other", value: otherValue, color: OTHER_SLICE_COLOR }]
    : head;
}
