"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { BarChart3, CalendarDays, LogOut, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

const LINKS = [
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/categories", label: "Categories", icon: Tags },
];

export function Nav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <header className="border-b bg-background/95 sticky top-0 z-40 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/calendar" className="font-heading text-lg font-semibold">
          TimeTrack
        </Link>

        <nav className="flex flex-1 items-center gap-1">
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

        {userEmail && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {userEmail}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(() => signOut())}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
