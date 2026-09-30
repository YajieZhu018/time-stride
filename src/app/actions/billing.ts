"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

/**
 * Opens Stripe's hosted Customer Portal (cancel, update card, invoices) for
 * the current user. Uses getSignedInUser, not getCurrentUserId, so a user
 * whose renewal failed can still get in to fix their card.
 */
export async function openBillingPortal() {
  const user = await getSignedInUser();
  const { stripeCustomerId } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  if (!stripeCustomerId) {
    redirect("/subscribe");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${await origin()}/calendar`,
  });

  redirect(session.url);
}

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
