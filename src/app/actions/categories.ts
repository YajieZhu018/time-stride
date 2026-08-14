"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { toCategory } from "@/lib/serialize";
import { categoryInputSchema, firstIssue } from "@/lib/validation";
import type { ActionResult, Category } from "@/types";

/**
 * Global defaults (userId: null) plus this user's own categories.
 * Defaults sort first, then custom ones alphabetically.
 */
export async function listCategories(): Promise<Category[]> {
  const userId = await getCurrentUserId();

  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return categories.map(toCategory);
}

export async function createCategory(
  input: unknown,
): Promise<ActionResult<Category>> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const userId = await getCurrentUserId();

    const duplicate = await prisma.category.findFirst({
      where: { name: parsed.data.name, OR: [{ userId: null }, { userId }] },
    });
    if (duplicate) {
      return { ok: false, error: `A category named "${parsed.data.name}" already exists` };
    }

    const category = await prisma.category.create({
      data: {
        userId,
        name: parsed.data.name,
        color: parsed.data.color,
        icon: parsed.data.icon || null,
        isDefault: false,
      },
    });

    revalidatePath("/categories");
    revalidatePath("/calendar");
    return { ok: true, data: toCategory(category) };
  } catch (error) {
    console.error("[actions/categories] create failed:", error);
    return { ok: false, error: "Could not create the category" };
  }
}

export async function updateCategory(
  id: string,
  input: unknown,
): Promise<ActionResult<Category>> {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const userId = await getCurrentUserId();
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) return { ok: false, error: "Category not found" };
    // Defaults are global rows shared by every user — editing one would change
    // it for everybody, so they are read-only.
    if (existing.userId !== userId) {
      return { ok: false, error: "Default categories cannot be edited" };
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        icon: parsed.data.icon || null,
      },
    });

    revalidatePath("/categories");
    revalidatePath("/calendar");
    revalidatePath("/analytics");
    return { ok: true, data: toCategory(category) };
  } catch (error) {
    console.error("[actions/categories] update failed:", error);
    return { ok: false, error: "Could not update the category" };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) return { ok: false, error: "Category not found" };
    if (existing.userId !== userId) {
      return { ok: false, error: "Default categories cannot be deleted" };
    }

    // TimeEvent.category has no cascade, so deleting a category still in use
    // would fail on the foreign key. Check first and explain why instead.
    const inUse = await prisma.timeEvent.count({ where: { categoryId: id } });
    if (inUse > 0) {
      return {
        ok: false,
        error: `"${existing.name}" is used by ${inUse} event${inUse === 1 ? "" : "s"}. Reassign or delete them first.`,
      };
    }

    await prisma.category.delete({ where: { id } });

    revalidatePath("/categories");
    revalidatePath("/calendar");
    return { ok: true, data: null };
  } catch (error) {
    console.error("[actions/categories] delete failed:", error);
    return { ok: false, error: "Could not delete the category" };
  }
}
