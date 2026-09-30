import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

type SignedInUser = {
  id: string;
  email: string;
  subscriptionStatus: string | null;
};

const USER_SELECT = { id: true, email: true, subscriptionStatus: true };

/** Stripe subscription statuses that grant access (see src/lib/stripe.ts). */
const ACCESS_STATUSES = new Set(["active", "trialing"]);

/**
 * Whether this user gets past the €9.90/month paywall: either their Stripe
 * subscription is live, or their email is in PAYWALL_EXEMPT_EMAILS (the owner).
 */
export function hasAccess(user: SignedInUser): boolean {
  const exempt = (process.env.PAYWALL_EXEMPT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(user.email.toLowerCase());

  return (
    exempt ||
    (user.subscriptionStatus !== null &&
      ACCESS_STATUSES.has(user.subscriptionStatus))
  );
}

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
 * This does NOT check the paywall — only /subscribe uses it directly, since
 * that page must render for unpaid users. Everything else goes through
 * getCurrentUserId() below.
 */
export const getSignedInUser = cache(async (): Promise<SignedInUser> => {
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
    select: USER_SELECT,
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email: authUser.email,
      name:
        (authUser.user_metadata?.full_name as string | undefined) ??
        (authUser.user_metadata?.name as string | undefined) ??
        null,
    },
    select: USER_SELECT,
  });
});

/**
 * The current user's id, for every server action and dashboard page. Sends
 * anyone without access (see hasAccess) to /subscribe, so the paywall covers
 * the whole app from this one place — nothing else resolves a user directly.
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
  const user = await getSignedInUser();

  if (!hasAccess(user)) {
    redirect("/subscribe");
  }

  return user.id;
});
