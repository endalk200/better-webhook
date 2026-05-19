import { describe, expect, it, vi } from "vitest";
import { createWebhookEndpoint } from "@better-webhook/core";
import { createStripeSignatureHeader, stripe } from "@better-webhook/stripe";
import {
  createNextRouteHandler,
  nextjsRawHeaderCapabilities,
  toRawDeliveryRequest,
} from "../src/index.js";

const secret = "whsec_test_secret";
const timestamp = 1_779_145_200;
const rawBody = JSON.stringify({
  id: "evt_123",
  object: "event",
  type: "invoice.paid",
  created: timestamp,
  data: { object: { id: "in_123", object: "invoice" } },
});

function nextRequest(body = rawBody) {
  return new Request("https://example.test/stripe", {
    method: "POST",
    headers: {
      "stripe-signature": createStripeSignatureHeader({
        secret,
        timestamp,
        rawBody: body,
      }),
    },
    body,
  });
}

describe("Next.js adapter", () => {
  it("declares Fetch header capability limits", () => {
    expect(nextjsRawHeaderCapabilities).toMatchObject({
      preservesRawBodyBytes: true,
      preservesDuplicateHeaders: false,
    });
  });

  it("converts route handler requests without parsing the body", async () => {
    const raw = await toRawDeliveryRequest(nextRequest());
    const bytes = typeof raw.body === "function" ? await raw.body() : raw.body;
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe(rawBody);
    expect(raw.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "stripe-signature" }),
      ]),
    );
  });

  it("translates successful and rejected core responses", async () => {
    const handler = vi.fn();
    const endpoint = createWebhookEndpoint({
      provider: stripe({ signingSecret: secret }),
      now: () => new Date(timestamp * 1000),
      handlers: { "invoice.paid": handler },
    });
    const route = createNextRouteHandler(endpoint);

    expect((await route(nextRequest())).status).toBe(200);

    const rejected = await route(
      new Request("https://example.test/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=bad" },
        body: rawBody,
      }),
    );
    expect(rejected.status).toBe(400);
    expect(handler).toHaveBeenCalledOnce();
  });
});
