import { config } from "../../config.js";

export const githubConfig = {
  // Namespaces local idempotency and replay keys for this specific Webhook Endpoint.
  endpointIdentity: "example-nextjs-github-local",
  idempotencyTtlMs: readNumber("GITHUB_WEBHOOK_IDEMPOTENCY_TTL_MS", 600_000),
  replayWindowMs: readNumber("GITHUB_WEBHOOK_REPLAY_WINDOW_MS", 300_000),
  webhookPath: "/api/webhooks/github",
  webhookSecret:
    process.env.GITHUB_WEBHOOK_SECRET ?? "github_better_webhook_local_example",
};

export function githubWebhookUrl(): string {
  return (
    process.env.GITHUB_WEBHOOK_URL ??
    `http://127.0.0.1:${config.port}${githubConfig.webhookPath}`
  );
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
