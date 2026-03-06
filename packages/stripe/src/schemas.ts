import { z } from "zod";

const StripeMetadataSchema = z.record(z.string(), z.string());

function createStripeExpandableNullableFieldSchema<TObject extends string>(
  objectType: TObject,
) {
  return z
    .union([
      z.string(),
      z
        .object({
          id: z.string(),
          object: z.literal(objectType),
        })
        .passthrough(),
    ])
    .nullable();
}

const StripeRequestSchema = z
  .object({
    id: z.string().nullable().optional(),
    idempotency_key: z.string().nullable().optional(),
  })
  .passthrough()
  .nullable();

const StripeChargeObjectSchema = z
  .object({
    id: z.string(),
    object: z.literal("charge"),
    amount: z.number(),
    currency: z.string(),
    status: z.string(),
    failure_code: z.string().nullable(),
    failure_message: z.string().nullable(),
    customer: createStripeExpandableNullableFieldSchema("customer"),
    payment_intent: createStripeExpandableNullableFieldSchema("payment_intent"),
    metadata: StripeMetadataSchema,
  })
  .passthrough();

const StripeCheckoutSessionObjectSchema = z
  .object({
    id: z.string(),
    object: z.literal("checkout.session"),
    mode: z.string(),
    payment_status: z.string(),
    amount_total: z.number().nullable(),
    currency: z.string().nullable(),
    customer: createStripeExpandableNullableFieldSchema("customer"),
    payment_intent: createStripeExpandableNullableFieldSchema("payment_intent"),
    status: z.string().nullable(),
    metadata: StripeMetadataSchema.nullable(),
  })
  .passthrough();

const StripePaymentIntentObjectSchema = z
  .object({
    id: z.string(),
    object: z.literal("payment_intent"),
    amount: z.number(),
    currency: z.string(),
    status: z.string(),
    customer: createStripeExpandableNullableFieldSchema("customer"),
    latest_charge: createStripeExpandableNullableFieldSchema("charge"),
    metadata: StripeMetadataSchema,
  })
  .passthrough();

const StripeEventBaseSchema = z
  .object({
    id: z.string(),
    object: z.literal("event"),
    api_version: z.string().nullable(),
    created: z.number(),
    livemode: z.boolean(),
    pending_webhooks: z.number(),
    request: StripeRequestSchema,
  })
  .passthrough();

/**
 * Schema for Stripe `charge.failed` webhook events.
 * Occurs whenever a failed charge attempt occurs.
 *
 * Includes `data.object` validated by `StripeChargeObjectSchema`.
 */
export const StripeChargeFailedEventSchema = StripeEventBaseSchema.extend({
  type: z.literal("charge.failed"),
  data: z
    .object({
      object: StripeChargeObjectSchema,
      previous_attributes: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
}).passthrough();

/**
 * Schema for Stripe `checkout.session.completed` webhook events.
 *
 * Includes `data.object` validated by `StripeCheckoutSessionObjectSchema`.
 */
export const StripeCheckoutSessionCompletedEventSchema =
  StripeEventBaseSchema.extend({
    type: z.literal("checkout.session.completed"),
    data: z
      .object({
        object: StripeCheckoutSessionObjectSchema,
        previous_attributes: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
  }).passthrough();

/**
 * Schema for Stripe `payment_intent.succeeded` webhook events.
 *
 * Includes `data.object` validated by `StripePaymentIntentObjectSchema`.
 */
export const StripePaymentIntentSucceededEventSchema =
  StripeEventBaseSchema.extend({
    type: z.literal("payment_intent.succeeded"),
    data: z
      .object({
        object: StripePaymentIntentObjectSchema,
        previous_attributes: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
  }).passthrough();

/**
 * Type inferred from `StripeChargeFailedEventSchema`.
 */
export type StripeChargeFailedEvent = z.infer<
  typeof StripeChargeFailedEventSchema
>;
/**
 * Type inferred from `StripeCheckoutSessionCompletedEventSchema`.
 */
export type StripeCheckoutSessionCompletedEvent = z.infer<
  typeof StripeCheckoutSessionCompletedEventSchema
>;
/**
 * Type inferred from `StripePaymentIntentSucceededEventSchema`.
 */
export type StripePaymentIntentSucceededEvent = z.infer<
  typeof StripePaymentIntentSucceededEventSchema
>;
