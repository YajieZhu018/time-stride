import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

/**
 * The single seam between this app and "who is the current user".
 *
 * Auth is Supabase Auth (session cookie, refreshed by src/proxy.ts on every
 * request). The Prisma schema is fully multi-user (every Category and
 * TimeEvent carries a userId), so once we know the signed-in email we just
 * need a matching User row — creating one on first sign-in.
 *
 * The pre-login seeded user's email is the owner's real address, so the
 * owner's first sign-in links to that existing row rather than creating a
 * second user and orphaning every event logged before login existed.
 *
 * Nothing else in the app resolves a user directly — every server action
 * calls this — so no other file needs to change if auth changes again later.
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    // src/proxy.ts already redirects signed-out visitors to /login before
    // any Server Component renders; this is the defensive fallback for any
    // path proxy.ts's matcher doesn't cover.
    redirect("/login");
  }

  const existing = await prisma.user.findUnique({
    where: { email: authUser.email },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email: authUser.email,
      name:
        (authUser.user_metadata?.full_name as string | undefined) ??
        (authUser.user_metadata?.name as string | undefined) ??
        null,
    },
    select: { id: true },
  });

  return created.id;
});
