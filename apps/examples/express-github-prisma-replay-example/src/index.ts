import express from "express";
import { prisma } from "./prisma.js";
import { githubHandler } from "./webhooks/github.js";

const app = express();
const portValue = process.env.PORT ?? "3005";
const port = Number(portValue);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new RangeError(
    `PORT must be an integer between 1 and 65535. Received: ${portValue}`,
  );
}

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  githubHandler,
);

app.get("/health", async (_req, res) => {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp });
  } catch (error) {
    console.error("Health check failed", error);
    res.status(503).json({ status: "error", timestamp });
  }
});

const server = app.listen(port, () => {
  console.log(
    `Express GitHub Prisma replay example listening on http://localhost:${port}`,
  );
  console.log("Endpoints:");
  console.log(`- POST http://localhost:${port}/webhooks/github`);
  console.log(`- GET  http://localhost:${port}/health`);
  console.log("Required env vars:");
  console.log("- GITHUB_WEBHOOK_SECRET");
  console.log("- DATABASE_URL");
});

let shuttingDown: Promise<void> | undefined;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    return shuttingDown;
  }

  shuttingDown = (async () => {
    console.log(`Received ${signal}, shutting down Prisma replay example`);

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("Failed to shut down cleanly", error);
      process.exit(1);
    }
  })();

  return shuttingDown;
};

process.once("beforeExit", () => {
  void prisma.$disconnect();
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
