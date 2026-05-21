export const config = {
  endpointIdentity:
    process.env.BETTER_WEBHOOK_ENDPOINT_IDENTITY ??
    "example-nextjs-stripe-local",
  idempotencyTtlMs: readNumber("BETTER_WEBHOOK_IDEMPOTENCY_TTL_MS", 600_000),
  otelEndpoint:
    process.env.BETTER_WEBHOOK_OTEL_ENDPOINT ?? "http://127.0.0.1:27686",
  otelServiceName:
    process.env.OTEL_SERVICE_NAME ?? "better-webhook-example-nextjs-stripe",
  port: readNumber("PORT", 3001),
  replayWindowMs: readNumber("BETTER_WEBHOOK_REPLAY_WINDOW_MS", 300_000),
  signingSecret:
    process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_better_webhook_local_example",
  webhookPath: "/api/webhooks/stripe",
};

export function webhookUrl(): string {
  return (
    process.env.BETTER_WEBHOOK_URL ??
    `http://127.0.0.1:${config.port}${config.webhookPath}`
  );
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
