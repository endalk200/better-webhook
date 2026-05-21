import {
  createMemoryIdempotencyStore,
  createMemoryReplayStore,
  createWebhookEndpoint,
} from "@better-webhook/core";
import { otel } from "@better-webhook/otel";
import {
  stripe,
  type StripeCheckoutSession,
  type StripeInvoice,
  type StripeWebhookEvent,
} from "@better-webhook/stripe";
import { trace } from "@opentelemetry/api";

import { config } from "./config.js";

export const endpoint = createWebhookEndpoint<StripeWebhookEvent>({
  catchAllHandlerScope: "unknown",
  endpointIdentity: config.endpointIdentity,
  handlers: {
    "checkout.session.completed": ({ event }) => {
      const session = event.payload as StripeCheckoutSession;
      console.log(
        `[example:express] handled checkout.session.completed event=${event.id} session=${session.id ?? "unknown"} payment_status=${session.payment_status ?? "unknown"}`,
      );
    },
    "invoice.paid": ({ event }) => {
      const invoice = event.payload as StripeInvoice;
      console.log(
        `[example:express] handled invoice.paid event=${event.id} invoice=${invoice.id ?? "unknown"} status=${invoice.status ?? "unknown"}`,
      );
    },
    "invoice.payment_failed": ({ event }) => {
      console.log(
        `[example:express] failing invoice.payment_failed event=${event.id} so the provider can retry`,
      );
      throw new Error("Intentional Express example handler failure");
    },
    "*": ({ event }) => {
      console.log(
        `[example:express] catch-all handled unknown verified event=${event.id} type=${event.type}`,
      );
    },
  },
  idempotencyStore: createMemoryIdempotencyStore(),
  idempotencyTtlMs: config.idempotencyTtlMs,
  provider: stripe({ signingSecret: config.signingSecret }),
  replayStore: createMemoryReplayStore(),
  replayWindowMs: config.replayWindowMs,
  telemetry: otel({
    tracer: trace.getTracer("better-webhook-example-express-stripe"),
  }),
});
