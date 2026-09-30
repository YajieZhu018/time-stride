import { Nav } from "@/components/layout/nav";
import { TimerWidget } from "@/components/calendar/timer-widget";
import { listCategories } from "@/app/actions/categories";
import { getSignedInUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Every route here reads per-user data live; nothing benefits from static
// prerendering, and prerendering would otherwise require a database
// connection at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  // listCategories goes through getCurrentUserId, which enforces the
  // paywall — so by the time we get past it, the user has access.
  const categories = await listCategories();
  const user = await getSignedInUser();
  const billing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  return (
    <>
      <Nav
        userEmail={user.email}
        hasBilling={Boolean(billing?.stripeCustomerId)}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-28">
        {children}
      </main>
      <TimerWidget categories={categories} />
    </>
  );
}
