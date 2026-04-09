import express from "express";
import { prisma } from "./prisma.js";
import { githubHandler } from "./webhooks/github.js";

const app = express();
const port = Number(process.env.PORT ?? "3005");

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  githubHandler,
);

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const shutdown = async (): Promise<void> => {
  await prisma.$disconnect();
};

process.on("beforeExit", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  void shutdown();
  process.exit(0);
});

app.listen(port, () => {
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
