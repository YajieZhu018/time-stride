import {
  BookOpen,
  Briefcase,
  Car,
  CircleDashed,
  Clapperboard,
  Coffee,
  HeartPulse,
  House,
  Moon,
  Rocket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Explicit map rather than a dynamic lookup: importing lucide's full icon set
 * to resolve a name at runtime would pull thousands of components into the
 * client bundle. Unknown names fall back to a plain colour dot, so a custom
 * category with a typo'd icon still renders.
 */
const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  "book-open": BookOpen,
  "heart-pulse": HeartPulse,
  clapperboard: Clapperboard,
  coffee: Coffee,
  users: Users,
  moon: Moon,
  house: House,
  car: Car,
  rocket: Rocket,
  "circle-dashed": CircleDashed,
};

export const ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon?: string;
  color: string;
  className?: string;
}) {
  const Icon = icon ? ICONS[icon] : undefined;

  if (!Icon) {
    return (
      <span
        className={cn("size-3.5 shrink-0 rounded-full", className)}
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }

  return (
    <Icon
      className={cn("size-4 shrink-0", className)}
      style={{ color }}
      aria-hidden
    />
  );
}
