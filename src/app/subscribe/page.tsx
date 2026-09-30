import { redirect } from "next/navigation";
import { Check } from "lucide-react";

import { getSignedInUser, hasAccess } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { openBillingPortal } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// Reads the signed-in user's live subscription status on every request.
export const dynamic = "force-dynamic";

const FEATURES = [
  "Planned vs. actual calendar",
  "Timer with one-click logging",
  "Analytics and insights",
];

/**
 * The paywall. getCurrentUserId() sends every signed-in user without an
 * active subscription here — including right after sign-up confirmation.
 */
export default async function SubscribePage() {
  const user = await getSignedInUser();
  if (hasAccess(user)) {
    redirect("/calendar");
  }

  // client_reference_id ties the resulting Checkout Session back to this
  // User row (read by /subscribe/success and the Stripe webhook).
  const paymentLink = new URL(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK!);
  paymentLink.searchParams.set("client_reference_id", user.id);
  paymentLink.searchParams.set("prefilled_email", user.email);

  // A lapsed subscriber (card declined, cancelled) already has a Stripe
  // customer and can fix it in the portal instead of starting over.
  const lapsed = user.subscriptionStatus !== null;

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">
            {lapsed ? "Your subscription has ended" : "Subscribe to TimeTrack"}
          </CardTitle>
          <CardDescription>
            {lapsed
              ? "Renew to get back to your calendar — your data is still here."
              : "One plan, everything included. Cancel anytime."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            <span className="font-heading text-3xl font-semibold">€9.90</span>
            <span className="text-muted-foreground text-sm"> / month</span>
          </p>
          <ul className="space-y-2 text-sm">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="text-primary size-4" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <a href={paymentLink.toString()}>Subscribe</a>
          </Button>
          {lapsed && (
            <form action={openBillingPortal} className="w-full">
              <Button type="submit" variant="outline" className="w-full">
                Update payment method
              </Button>
            </form>
          )}
          <form action={signOut}>
            <Button type="submit" variant="link" size="sm">
              Signed in as {user.email} — sign out
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
