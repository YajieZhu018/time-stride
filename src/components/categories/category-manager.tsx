"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { CategoryIcon } from "@/components/categories/category-icon";
import { deleteCategory } from "@/app/actions/categories";
import type { Category } from "@/types";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const defaults = categories.filter((category) => category.isDefault);
  const custom = categories.filter((category) => !category.isDefault);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDialogOpen(true);
  }

  function handleDelete(category: Category) {
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted "${category.name}"`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Defaults are shared and read-only. Add your own for anything else.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          New category
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
          Your categories
        </h2>
        {custom.length === 0 ? (
          <Card className="text-muted-foreground p-6 text-sm">
            No custom categories yet.
          </Card>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {custom.map((category) => (
              <li key={category.id}>
                <Card className="flex flex-row items-center gap-3 p-3">
                  <CategoryIcon icon={category.icon} color={category.color} />
                  <span className="flex-1 truncate font-medium">
                    {category.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => openEdit(category)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${category.name}`}
                    disabled={isPending}
                    onClick={() => handleDelete(category)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
          Defaults
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {defaults.map((category) => (
            <li key={category.id}>
              <Card className="flex flex-row items-center gap-3 p-3">
                <CategoryIcon icon={category.icon} color={category.color} />
                <span className="flex-1 truncate font-medium">
                  {category.name}
                </span>
                <Badge variant="secondary">Default</Badge>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
      />
    </div>
  );
}
