import {
  createMemoryIdempotencyStore,
  createMemoryReplayStore,
  createWebhookEndpoint,
} from "@better-webhook/core";
import {
  sendExpressResponse,
  toRawDeliveryRequest,
  type ExpressWebhookRequest,
} from "@better-webhook/express";
import { otel } from "@better-webhook/otel";
import {
  stripe,
  type StripeCheckoutSession,
  type StripeInvoice,
  type StripeWebhookEvent,
} from "@better-webhook/stripe";
import { trace } from "@opentelemetry/api";
import express from "express";

import { stripeConfig } from "../providers/stripe/config.js";

const stripeEndpoint = createWebhookEndpoint<StripeWebhookEvent>({
  catchAllHandlerScope: "unknown",
  endpointIdentity: stripeConfig.endpointIdentity,
  handlers: {
    "checkout.session.completed": ({ event }) => {
      const session = event.payload as StripeCheckoutSession;
      console.log(
        `[example:express:stripe] handled checkout.session.completed event=${event.id} session=${session.id ?? "unknown"} payment_status=${session.payment_status ?? "unknown"}`,
      );
    },
    "invoice.paid": ({ event }) => {
      const invoice = event.payload as StripeInvoice;
      console.log(
        `[example:express:stripe] handled invoice.paid event=${event.id} invoice=${invoice.id ?? "unknown"} status=${invoice.status ?? "unknown"}`,
      );
    },
    "invoice.payment_failed": ({ event }) => {
      console.log(
        `[example:express:stripe] failing invoice.payment_failed event=${event.id} so the provider can retry`,
      );
      throw new Error("Intentional Express Stripe example handler failure");
    },
    "*": ({ event }) => {
      console.log(
        `[example:express:stripe] catch-all handled unknown verified event=${event.id} type=${event.type}`,
      );
    },
  },
  // Memory stores make the local delivery scenarios visible; production endpoints should use durable stores.
  idempotencyStore: createMemoryIdempotencyStore(),
  idempotencyTtlMs: stripeConfig.idempotencyTtlMs,
  provider: stripe({ signingSecret: stripeConfig.signingSecret }),
  replayStore: createMemoryReplayStore(),
  replayWindowMs: stripeConfig.replayWindowMs,
  telemetry: otel({
    tracer: trace.getTracer("better-webhook-example-express-stripe"),
  }),
});

export const stripeWebhookRouter: express.Router = express.Router();

stripeWebhookRouter.post(
  stripeConfig.webhookPath,
  // Stripe signature verification needs the exact raw body bytes before any JSON parser runs.
  express.raw({ type: "application/json" }),
  async (request, response, next) => {
    try {
      const expressRequest = request as ExpressWebhookRequest;
      expressRequest.rawBody = request.body;
      const { result, response: webhookResponse } =
        await stripeEndpoint.handleWithResult(
          toRawDeliveryRequest(expressRequest),
        );

      console.log(
        `[example:express:stripe] delivery result status=${result.status} event=${result.eventType ?? "unknown"} id=${result.eventId ?? "none"} response=${webhookResponse.status}`,
      );
      sendExpressResponse(response, webhookResponse);
    } catch (error) {
      next(error);
    }
  },
);
