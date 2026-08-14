"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategory, updateCategory } from "@/app/actions/categories";
import { categoryInputSchema, type CategoryInput } from "@/lib/validation";
import { ICON_NAMES } from "@/components/categories/category-icon";
import type { Category } from "@/types";

const PRESET_COLORS = [
  "#2563EB", "#7C3AED", "#10B981", "#F59E0B", "#06B6D4", "#EC4899",
  "#6366F1", "#84CC16", "#F97316", "#14B8A6", "#EF4444", "#6B7280",
];

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: { name: "", color: "#2563EB", icon: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: category?.name ?? "",
      color: category?.color ?? "#2563EB",
      icon: category?.icon ?? "",
    });
  }, [open, category, form]);

  const color = form.watch("color");

  function onSubmit(values: CategoryInput) {
    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, values)
        : await createCategory(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(category ? "Category updated" : "Category created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Categories group your planned and actual time, and give each block
            its colour on the calendar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input id="category-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-color">Colour</Label>
            <div className="flex items-center gap-2">
              <input
                id="category-color"
                type="color"
                className="border-input size-9 shrink-0 cursor-pointer rounded-md border bg-transparent"
                value={color}
                onChange={(event) =>
                  form.setValue("color", event.target.value, {
                    shouldValidate: true,
                  })
                }
              />
              <Input
                aria-label="Hex colour"
                {...form.register("color")}
                className="font-mono w-32"
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="size-6 rounded-full border"
                    style={{ backgroundColor: preset }}
                    aria-label={`Use ${preset}`}
                    onClick={() =>
                      form.setValue("color", preset, { shouldValidate: true })
                    }
                  />
                ))}
              </div>
            </div>
            {form.formState.errors.color ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.color.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-icon">Icon</Label>
            <Select
              value={form.watch("icon") || "none"}
              onValueChange={(value) =>
                form.setValue("icon", value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="category-icon" className="w-full">
                <SelectValue placeholder="No icon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No icon</SelectItem>
                {ICON_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {category ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
