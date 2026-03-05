import { defineEvent } from "@better-webhook/core";
import {
  StripeChargeFailedEventSchema,
  StripeCheckoutSessionCompletedEventSchema,
  StripePaymentIntentSucceededEventSchema,
} from "./schemas.js";

export type StripeProvider = "stripe";

export const charge_failed = defineEvent({
  name: "charge.failed",
  schema: StripeChargeFailedEventSchema,
  provider: "stripe" as const,
});

export const checkout_session_completed = defineEvent({
  name: "checkout.session.completed",
  schema: StripeCheckoutSessionCompletedEventSchema,
  provider: "stripe" as const,
});

export const payment_intent_succeeded = defineEvent({
  name: "payment_intent.succeeded",
  schema: StripePaymentIntentSucceededEventSchema,
  provider: "stripe" as const,
});

export type {
  StripeChargeFailedEvent,
  StripeCheckoutSessionCompletedEvent,
  StripePaymentIntentSucceededEvent,
} from "./schemas.js";
