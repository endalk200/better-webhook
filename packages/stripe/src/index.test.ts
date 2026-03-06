import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryReplayStore } from "@better-webhook/core";
import { stripe } from "./index.js";
import {
  charge_failed,
  checkout_session_completed,
  payment_intent_succeeded,
} from "./events.js";
import {
  StripeChargeFailedEventSchema,
  StripeCheckoutSessionCompletedEventSchema,
  StripePaymentIntentSucceededEventSchema,
  type StripeChargeFailedEvent,
  type StripeCheckoutSessionCompletedEvent,
  type StripePaymentIntentSucceededEvent,
} from "./schemas.js";

const secret = "whsec_test_secret";

const chargeFailedEvent: StripeChargeFailedEvent = {
  id: "evt_charge_failed_1",
  object: "event",
  api_version: "2024-06-20",
  created: 1730000000,
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: "req_123",
    idempotency_key: "idem_123",
  },
  type: "charge.failed",
  data: {
    object: {
      id: "ch_123",
      object: "charge",
      amount: 5000,
      currency: "usd",
      status: "failed",
      failure_code: "card_declined",
      failure_message: "The card was declined.",
      customer: "cus_123",
      payment_intent: "pi_123",
      metadata: {
        order_id: "order_123",
      },
      receipt_url: "https://example.com/receipt/ch_123",
    },
  },
};

const checkoutSessionCompletedEvent: StripeCheckoutSessionCompletedEvent = {
  id: "evt_checkout_completed_1",
  object: "event",
  api_version: "2024-06-20",
  created: 1730000100,
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: "req_124",
    idempotency_key: "idem_124",
  },
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      object: "checkout.session",
      mode: "payment",
      payment_status: "paid",
      amount_total: 5000,
      currency: "usd",
      customer: "cus_123",
      payment_intent: "pi_123",
      status: "complete",
      metadata: {
        cart_id: "cart_1",
      },
      custom_text: {
        submit: {
          message: "Thanks!",
        },
      },
    },
  },
};

const paymentIntentSucceededEvent: StripePaymentIntentSucceededEvent = {
  id: "evt_pi_succeeded_1",
  object: "event",
  api_version: "2024-06-20",
  created: 1730000200,
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: "req_125",
    idempotency_key: "idem_125",
  },
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_123",
      object: "payment_intent",
      amount: 5000,
      currency: "usd",
      status: "succeeded",
      customer: "cus_123",
      latest_charge: "ch_123",
      metadata: {
        invoice_id: "inv_123",
      },
      amount_received: 5000,
    },
  },
};

const expandedCustomer = {
  id: "cus_123",
  object: "customer",
  email: "user@example.com",
};

const expandedPaymentIntent = {
  id: "pi_123",
  object: "payment_intent",
  status: "succeeded",
};

const expandedCharge = {
  id: "ch_123",
  object: "charge",
  status: "succeeded",
};

function createStripeSignature(
  body: string,
  signingSecret: string,
  timestamp: number,
): string {
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(`${timestamp}.${body}`, "utf-8");
  return hmac.digest("hex");
}

function createStripeSignatureHeader(options: {
  body: string;
  secret: string;
  timestamp?: number;
  additionalV1Signatures?: string[];
}): string {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const validSignature = createStripeSignature(
    options.body,
    options.secret,
    timestamp,
  );
  const allSignatures = [
    validSignature,
    ...(options.additionalV1Signatures ?? []),
  ];
  return `t=${timestamp},${allSignatures.map((sig) => `v1=${sig}`).join(",")}`;
}

describe("Stripe Schemas", () => {
  it("validates charge.failed payload", () => {
    const result = StripeChargeFailedEventSchema.safeParse(chargeFailedEvent);
    expect(result.success).toBe(true);
  });

  it("validates checkout.session.completed payload", () => {
    const result = StripeCheckoutSessionCompletedEventSchema.safeParse(
      checkoutSessionCompletedEvent,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.object.custom_text?.submit?.message).toBe(
        "Thanks!",
      );
    }
  });

  it("validates payment_intent.succeeded payload", () => {
    const result = StripePaymentIntentSucceededEventSchema.safeParse(
      paymentIntentSucceededEvent,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.object.amount_received).toBe(5000);
    }
  });

  it("accepts expanded charge fields in charge.failed payloads", () => {
    const result = StripeChargeFailedEventSchema.safeParse({
      ...chargeFailedEvent,
      data: {
        ...chargeFailedEvent.data,
        object: {
          ...chargeFailedEvent.data.object,
          customer: expandedCustomer,
          payment_intent: expandedPaymentIntent,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts nullable metadata and expanded fields in checkout sessions", () => {
    const result = StripeCheckoutSessionCompletedEventSchema.safeParse({
      ...checkoutSessionCompletedEvent,
      data: {
        ...checkoutSessionCompletedEvent.data,
        object: {
          ...checkoutSessionCompletedEvent.data.object,
          customer: expandedCustomer,
          payment_intent: expandedPaymentIntent,
          metadata: null,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts expanded latest_charge and customer on payment intents", () => {
    const result = StripePaymentIntentSucceededEventSchema.safeParse({
      ...paymentIntentSucceededEvent,
      data: {
        ...paymentIntentSucceededEvent.data,
        object: {
          ...paymentIntentSucceededEvent.data.object,
          customer: expandedCustomer,
          latest_charge: expandedCharge,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects expanded customer objects with the wrong Stripe resource type", () => {
    const result = StripeChargeFailedEventSchema.safeParse({
      ...chargeFailedEvent,
      data: {
        ...chargeFailedEvent.data,
        object: {
          ...chargeFailedEvent.data.object,
          customer: expandedCharge,
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects expanded payment_intent objects with the wrong Stripe resource type", () => {
    const result = StripeCheckoutSessionCompletedEventSchema.safeParse({
      ...checkoutSessionCompletedEvent,
      data: {
        ...checkoutSessionCompletedEvent.data,
        object: {
          ...checkoutSessionCompletedEvent.data.object,
          payment_intent: expandedCharge,
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects expanded latest_charge objects with the wrong Stripe resource type", () => {
    const result = StripePaymentIntentSucceededEventSchema.safeParse({
      ...paymentIntentSucceededEvent,
      data: {
        ...paymentIntentSucceededEvent.data,
        object: {
          ...paymentIntentSucceededEvent.data.object,
          latest_charge: expandedPaymentIntent,
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid payload shape", () => {
    const result = StripeChargeFailedEventSchema.safeParse({
      id: "evt_invalid",
      type: "charge.failed",
    });
    expect(result.success).toBe(false);
  });

  it("accepts request object when idempotency_key is omitted", () => {
    const result = StripeChargeFailedEventSchema.safeParse({
      ...chargeFailedEvent,
      request: {
        id: "req_omitted_idempotency",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts request object when id is omitted", () => {
    const result = StripeChargeFailedEventSchema.safeParse({
      ...chargeFailedEvent,
      request: {
        idempotency_key: "idem_omitted_request_id",
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("stripe()", () => {
  beforeEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.WEBHOOK_SECRET;
  });

  it("creates a stripe webhook builder", () => {
    const webhook = stripe();
    expect(webhook).toBeDefined();
    expect(webhook.getProvider().name).toBe("stripe");
  });

  it("accepts a secret option", () => {
    const webhook = stripe({ secret });
    expect(webhook.getProvider().secret).toBe(secret);
  });

  it("exposes replay context from event id and signature timestamp", () => {
    const provider = stripe().getProvider();
    const replayContext = provider.getReplayContext?.(
      {
        "stripe-signature": "t=1730000300,v1=abc",
      },
      {
        id: "evt_123",
      },
    );

    expect(replayContext).toEqual({
      replayKey: "evt_123",
      timestamp: 1730000300,
    });
  });

  it("keeps deliveryId undefined for Stripe requests", () => {
    const provider = stripe().getProvider();
    expect(
      provider.getDeliveryId({
        "stripe-event-id": "evt_from_non_standard_header",
      }),
    ).toBeUndefined();
  });

  it("routes charge.failed events", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const webhook = stripe({ secret }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({ body, secret }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "charge.failed",
      }),
      expect.objectContaining({
        eventType: "charge.failed",
        provider: "stripe",
      }),
    );
  });

  it("routes checkout.session.completed events", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(checkoutSessionCompletedEvent);
    const webhook = stripe({ secret }).event(
      checkout_session_completed,
      handler,
    );

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({ body, secret }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "checkout.session.completed",
      }),
      expect.objectContaining({
        eventType: "checkout.session.completed",
      }),
    );
  });

  it("routes payment_intent.succeeded events", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(paymentIntentSucceededEvent);
    const webhook = stripe({ secret }).event(payment_intent_succeeded, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({ body, secret }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "payment_intent.succeeded",
      }),
      expect.objectContaining({
        eventType: "payment_intent.succeeded",
      }),
    );
  });

  it("accepts rotated signatures when any v1 signature matches", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const validTimestamp = Math.floor(Date.now() / 1000);
    const validSignature = createStripeSignature(body, secret, validTimestamp);
    const webhook = stripe({ secret }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${validTimestamp},v1=invalid,v1=${validSignature}`,
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid signatures", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const freshTimestamp = Math.floor(Date.now() / 1000);
    const webhook = stripe({ secret }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${freshTimestamp},v1=invalid`,
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects missing signature header", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const webhook = stripe({ secret }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects stale signatures based on timestamp tolerance", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const staleTimestamp = Math.floor(Date.now() / 1000) - 601;
    const webhook = stripe({
      secret,
      timestampToleranceSeconds: 300,
    }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({
          body,
          secret,
          timestamp: staleTimestamp,
        }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects far-future signatures based on timestamp tolerance", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const futureTimestamp = Math.floor(Date.now() / 1000) + 601;
    const webhook = stripe({
      secret,
      timestampToleranceSeconds: 300,
    }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({
          body,
          secret,
          timestamp: futureTimestamp,
        }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows stale signatures when timestamp tolerance is disabled", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const staleTimestamp = Math.floor(Date.now() / 1000) - 86400;
    const webhook = stripe({
      secret,
      timestampToleranceSeconds: 0,
    }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({
          body,
          secret,
          timestamp: staleTimestamp,
        }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("allows stale signatures when timestamp tolerance is negative", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const staleTimestamp = Math.floor(Date.now() / 1000) - 86400;
    const webhook = stripe({
      secret,
      timestampToleranceSeconds: -1,
    }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({
          body,
          secret,
          timestamp: staleTimestamp,
        }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("falls back to default tolerance when timestamp tolerance is non-finite", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const staleTimestamp = Math.floor(Date.now() / 1000) - 601;
    const webhook = stripe({
      secret,
      timestampToleranceSeconds: Number.NaN,
    }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({
          body,
          secret,
          timestamp: staleTimestamp,
        }),
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects malformed timestamps in Stripe-Signature", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const validTimestamp = Math.floor(Date.now() / 1000);
    const validSignature = createStripeSignature(body, secret, validTimestamp);
    const webhook = stripe({ secret }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${validTimestamp}abc,v1=${validSignature}`,
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects signatures without a valid timestamp", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const validTimestamp = Math.floor(Date.now() / 1000);
    const validSignature = createStripeSignature(body, secret, validTimestamp);
    const webhook = stripe({ secret }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": `v1=${validSignature}`,
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("accepts signatures with extra whitespace around segments", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const validTimestamp = Math.floor(Date.now() / 1000);
    const validSignature = createStripeSignature(body, secret, validTimestamp);
    const webhook = stripe({ secret }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": ` t = ${validTimestamp} , v1 = ${validSignature} `,
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("uses the last valid t value when multiple timestamps are present", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const staleTimestamp = Math.floor(Date.now() / 1000) - 601;
    const validTimestamp = Math.floor(Date.now() / 1000);
    const validSignature = createStripeSignature(body, secret, validTimestamp);
    const webhook = stripe({
      secret,
      timestampToleranceSeconds: 300,
    }).event(charge_failed, handler);

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${staleTimestamp},t=${validTimestamp},v1=${validSignature}`,
      },
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("enforces replay protection for duplicate Stripe event ids", async () => {
    const handler = vi.fn();
    const body = JSON.stringify(chargeFailedEvent);
    const webhook = stripe({ secret })
      .withReplayProtection({
        store: createInMemoryReplayStore(),
      })
      .event(charge_failed, handler);

    const firstResult = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({ body, secret }),
      },
      rawBody: body,
    });

    const secondResult = await webhook.process({
      headers: {
        "content-type": "application/json",
        "stripe-signature": createStripeSignatureHeader({ body, secret }),
      },
      rawBody: body,
    });

    expect(firstResult.status).toBe(200);
    expect(secondResult.status).toBe(409);
    expect(secondResult.body?.error).toBe("Duplicate webhook delivery");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
