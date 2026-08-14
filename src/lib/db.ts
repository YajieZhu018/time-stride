import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Avoid exhausting Neon's connection limit through hot-reload in development.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
