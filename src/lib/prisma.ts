// Singleton Prisma client setup with hot-reload protection & conditional query logging.
import { PrismaClient } from "@prisma/client";
import { generateEntityCode } from "./prisma-middleware";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  _prismaMiddlewareApplied?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Always store to globalThis to prevent multiple PrismaClient instances in production
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Apply middleware only once (prevents duplicate registration on hot-reload)
if (!globalForPrisma._prismaMiddlewareApplied) {
  generateEntityCode(prisma);
  globalForPrisma._prismaMiddlewareApplied = true;
}
