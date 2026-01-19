// Singleton Prisma client setup with dev-mode hot-reload protection & conditional query logging.
import { PrismaClient } from "@prisma/client";
import { generateEntityCode } from "./prisma-middleware";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Apply middleware for auto-generating entity codes
generateEntityCode(prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
