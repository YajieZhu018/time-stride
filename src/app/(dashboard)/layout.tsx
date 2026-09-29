import { Nav } from "@/components/layout/nav";
import { TimerWidget } from "@/components/calendar/timer-widget";
import { listCategories } from "@/app/actions/categories";
import { createClient } from "@/lib/supabase/server";

// Every route here reads per-user data live; nothing benefits from static
// prerendering, and prerendering would otherwise require a database
// connection at build time.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const supabase = await createClient();
  const categories = await listCategories();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Nav userEmail={user?.email ?? null} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-28">
        {children}
      </main>
      <TimerWidget categories={categories} />
    </>
  );
}
