import { getStripe, syncCheckoutSession, syncSubscription } from "@/lib/stripe";

/**
 * Stripe → app billing events. Registered in the Stripe dashboard (or via
 * the Stripe CLI's `stripe listen` locally) with STRIPE_WEBHOOK_SECRET as its
 * signing secret. src/lib/supabase/proxy.ts lets this path through without a
 * session, so the signature check below is its only authentication.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event;
  try {
    // Must be the raw body: re-serialised JSON won't match the signature.
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("[stripe/webhook] signature check failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await syncCheckoutSession(event.data.object.id);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
  }

  return new Response(null, { status: 200 });
}
