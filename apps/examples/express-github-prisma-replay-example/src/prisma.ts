import { PrismaClient } from "@prisma/client";

declare global {
  var prismaReplayExampleClient: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaReplayExampleClient ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaReplayExampleClient = prisma;
}
