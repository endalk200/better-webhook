import { defineEvent } from "@better-webhook/core";
import {
  StripeChargeFailedEventSchema,
  StripeCheckoutSessionCompletedEventSchema,
  StripePaymentIntentSucceededEventSchema,
} from "./schemas.js";

/**
 * Stripe provider identifier used by this package.
 */
export type StripeProvider = "stripe";

/**
 * Event definition for Stripe `charge.failed` using `StripeChargeFailedEventSchema`.
 */
export const charge_failed = defineEvent({
  name: "charge.failed",
  schema: StripeChargeFailedEventSchema,
  provider: "stripe" as const,
});

/**
 * Event definition for Stripe `checkout.session.completed` using `StripeCheckoutSessionCompletedEventSchema`.
 */
export const checkout_session_completed = defineEvent({
  name: "checkout.session.completed",
  schema: StripeCheckoutSessionCompletedEventSchema,
  provider: "stripe" as const,
});

/**
 * Event definition for Stripe `payment_intent.succeeded` using `StripePaymentIntentSucceededEventSchema`.
 */
export const payment_intent_succeeded = defineEvent({
  name: "payment_intent.succeeded",
  schema: StripePaymentIntentSucceededEventSchema,
  provider: "stripe" as const,
});

/**
 * Re-exported event payload types inferred from schemas in `./schemas.js`.
 */
export type {
  StripeChargeFailedEvent,
  StripeCheckoutSessionCompletedEvent,
  StripePaymentIntentSucceededEvent,
} from "./schemas.js";
