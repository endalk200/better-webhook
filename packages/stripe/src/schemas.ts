import { z } from "zod";

const StripeMetadataSchema = z.record(z.string(), z.string());
const StripeExpandableObjectSchema = z
  .object({
    id: z.string(),
    object: z.string(),
  })
  .passthrough();
const StripeExpandableNullableFieldSchema = z
  .union([z.string(), StripeExpandableObjectSchema])
  .nullable();

const StripeRequestSchema = z
  .object({
    id: z.string().nullable(),
    idempotency_key: z.string().nullable(),
  })
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
    customer: StripeExpandableNullableFieldSchema,
    payment_intent: StripeExpandableNullableFieldSchema,
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
    customer: StripeExpandableNullableFieldSchema,
    payment_intent: StripeExpandableNullableFieldSchema,
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
    customer: StripeExpandableNullableFieldSchema,
    latest_charge: StripeExpandableNullableFieldSchema,
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

export const StripeChargeFailedEventSchema = StripeEventBaseSchema.extend({
  type: z.literal("charge.failed"),
  data: z
    .object({
      object: StripeChargeObjectSchema,
      previous_attributes: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
}).passthrough();

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

export type StripeChargeFailedEvent = z.infer<
  typeof StripeChargeFailedEventSchema
>;
export type StripeCheckoutSessionCompletedEvent = z.infer<
  typeof StripeCheckoutSessionCompletedEventSchema
>;
export type StripePaymentIntentSucceededEvent = z.infer<
  typeof StripePaymentIntentSucceededEventSchema
>;
