import { CategoryManager } from "@/components/categories/category-manager";
import { listCategories } from "@/app/actions/categories";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategories();
  return <CategoryManager categories={categories} />;
}
