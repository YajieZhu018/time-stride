import type { TimeEvent } from "@/types";

export interface PositionedEvent {
  event: TimeEvent;
  /** Zero-based column within its overlap cluster. */
  column: number;
  /** How many columns that cluster needs. */
  columns: number;
}

/**
 * Side-by-side layout for events that overlap in time.
 *
 * Events are grouped into clusters of transitively-overlapping blocks, and each
 * cluster is divided into the fewest columns that keep every block visible.
 * Without this, two overlapping blocks stack exactly on top of each other and
 * the one underneath becomes unreachable.
 */
export function packOverlaps(events: TimeEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const byStart = a.startTime.getTime() - b.startTime.getTime();
    if (byStart !== 0) return byStart;
    // Longer events first, so they take the leftmost column.
    return b.endTime.getTime() - a.endTime.getTime();
  });

  const positioned: PositionedEvent[] = [];
  let cluster: PositionedEvent[] = [];
  let clusterEnd = 0;
  // Last end time per column, used to find the first free column.
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = columnEnds.length || 1;
    for (const entry of cluster) entry.columns = columns;
    positioned.push(...cluster);
    cluster = [];
    columnEnds = [];
    clusterEnd = 0;
  };

  for (const event of sorted) {
    const start = event.startTime.getTime();
    const end = event.endTime.getTime();

    // No overlap with anything still open: the previous cluster is complete.
    if (cluster.length > 0 && start >= clusterEnd) flush();

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }

    cluster.push({ event, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }

  if (cluster.length > 0) flush();

  return positioned;
}
