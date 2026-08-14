import { CalendarView } from "@/components/calendar/calendar-view";
import { listCategories } from "@/app/actions/categories";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const categories = await listCategories();
  return <CalendarView categories={categories} />;
}
