import Stripe from "stripe";
import { prisma } from "@/lib/db";

/**
 * Billing is a single €9.90/month Stripe Payment Link (NEXT_PUBLIC_STRIPE_PAYMENT_LINK).
 * The app never creates prices or checkout sessions itself — it only mirrors
 * the resulting subscription's status onto the User row, which
 * getCurrentUserId() (src/lib/auth.ts) then gates on.
 */
let client: Stripe | undefined;

/**
 * Created on first use, not at import: the Stripe constructor throws without
 * a key, and the nav imports billing code on every dashboard page.
 */
export function getStripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/**
 * Links a completed Checkout Session to its User (via client_reference_id,
 * which the /subscribe page puts on the Payment Link URL) and records the
 * subscription it created. Called from both /subscribe/success (so access is
 * immediate) and the webhook (so it still happens if the user closes the tab).
 */
export async function syncCheckoutSession(sessionId: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const userId = session.client_reference_id;
  const subscription = session.subscription;
  if (!userId || !subscription || typeof subscription === "string") {
    return null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId:
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null),
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    },
  });

  return userId;
}

/**
 * Mirrors a subscription's current status (renewal failed, cancelled, ...)
 * onto whichever User it was linked to by syncCheckoutSession.
 */
export async function syncSubscription(subscription: Stripe.Subscription) {
  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { subscriptionStatus: subscription.status },
  });
}
