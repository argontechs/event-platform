import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. Re-uses one instance across hot reloads in dev to
 * avoid exhausting database connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export generated types/enums so app code imports from "@event/db".
export * from "@prisma/client";
