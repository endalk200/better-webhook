export const config = {
  otelEndpoint:
    process.env.BETTER_WEBHOOK_OTEL_ENDPOINT ?? "http://127.0.0.1:27686",
  otelServiceName:
    process.env.OTEL_SERVICE_NAME ?? "better-webhook-example-express",
  port: readNumber("PORT", 3000),
};

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
