import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../src/lib/default-categories";

const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.TIMETRACK_OWNER_EMAIL ?? "yajie.zhu@icloud.com";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {},
    create: { email: OWNER_EMAIL, name: "Yajie" },
  });
  console.log(`User ready: ${user.email} (${user.id})`);

  // Category has no unique constraint on name, so upsert isn't available;
  // find-then-write keeps re-seeding idempotent without changing the schema.
  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: null, name: category.name },
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { color: category.color, icon: category.icon, isDefault: true },
      });
    } else {
      await prisma.category.create({
        data: { ...category, isDefault: true, userId: null },
      });
    }
  }

  const count = await prisma.category.count({ where: { userId: null } });
  console.log(`Default categories ready: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
