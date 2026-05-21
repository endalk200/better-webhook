import { config } from "../../config.js";

export const stripeConfig = {
  // Namespaces local idempotency and replay keys for this specific Webhook Endpoint.
  endpointIdentity: "example-nextjs-stripe-local",
  idempotencyTtlMs: readNumber("STRIPE_WEBHOOK_IDEMPOTENCY_TTL_MS", 600_000),
  replayWindowMs: readNumber("STRIPE_WEBHOOK_REPLAY_WINDOW_MS", 300_000),
  signingSecret:
    process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_better_webhook_local_example",
  webhookPath: "/api/webhooks/stripe",
};

export function stripeWebhookUrl(): string {
  return (
    process.env.STRIPE_WEBHOOK_URL ??
    `http://127.0.0.1:${config.port}${stripeConfig.webhookPath}`
  );
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
