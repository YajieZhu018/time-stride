import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { getSignedInUser } from "@/lib/auth";
import { syncCheckoutSession } from "@/lib/stripe";

/**
 * Where the Payment Link sends the user after paying
 * (`?session_id={CHECKOUT_SESSION_ID}`, configured on the link in Stripe).
 *
 * Syncs the subscription right here rather than waiting for the webhook, so
 * the user lands straight in the app instead of bouncing off the paywall.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const user = await getSignedInUser();

  if (sessionId) {
    const linkedUserId = await syncCheckoutSession(sessionId);
    if (linkedUserId === user.id) {
      redirect("/calendar");
    }
  }

  redirect("/subscribe");
}
