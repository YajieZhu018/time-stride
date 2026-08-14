"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/categories", label: "Categories", icon: Tags },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background/95 sticky top-0 z-40 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/calendar" className="font-heading text-lg font-semibold">
          TimeTrack
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
