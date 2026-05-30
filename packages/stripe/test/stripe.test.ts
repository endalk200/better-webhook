import { createMemoryIdempotencyStore, createWebhookEndpoint } from "@better-webhook/core";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { type StripeWebhookEvent, stripe, type UnknownStripeEvent } from "../src/index.js";
import { createStripeReplayKey, createStripeSignatureHeader } from "../src/stripe.js";

const secret = "whsec_test_secret";
const timestamp = 1_779_145_200;

function body(type = "invoice.paid") {
	return JSON.stringify({
		id: "evt_123",
		object: "event",
		type,
		created: timestamp,
		data: {
			object: {
				id: "in_123",
				object: "invoice",
				status: "paid",
			},
		},
	});
}

function request(
	rawBody = body(),
	signature = createStripeSignatureHeader({ secret, timestamp, rawBody }),
) {
	return {
		method: "POST",
		url: "https://example.test/stripe",
		headers: [{ name: "stripe-signature", value: signature }],
		body: rawBody,
	};
}

describe("stripe provider", () => {
	it("requires a configured signing secret", () => {
		expect(() => stripe({ signingSecret: "" })).toThrow("Stripe Provider Secret is required");
		expect(() =>
			stripe({
				signingSecret: undefined as unknown as string,
			}),
		).toThrow("Stripe Provider Secret is required");
	});

	it("verifies real Stripe HMAC semantics over raw bytes", async () => {
		const handler = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: stripe({ signingSecret: secret }),
			handlers: { "invoice.paid": handler },
			now: () => new Date(timestamp * 1000),
		});

		const { response, result } = await endpoint.handleWithResult(request());

		expect(response.status).toBe(200);
		expect(result.status).toBe("handled");
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: expect.objectContaining({
					id: "evt_123",
					type: "invoice.paid",
					known: true,
				}),
			}),
		);
	});

	it("rejects invalid signatures, wrong secrets, stale timestamps, and mutated bodies", async () => {
		const provider = stripe({ signingSecret: secret });
		const valid = request();
		const validDelivery = {
			method: valid.method,
			url: valid.url,
			headers: valid.headers,
			rawBody: new TextEncoder().encode(body()),
		};

		expect(await provider.verify(validDelivery)).toMatchObject({ ok: true });
		expect(
			await provider.verify({
				...validDelivery,
				headers: [{ name: "stripe-signature", value: "t=1,v1=bad" }],
			}),
		).toMatchObject({
			ok: false,
		});
		expect(
			await provider.verify({
				...validDelivery,
				headers: [
					{
						name: "stripe-signature",
						value: `t=${timestamp},v1=${"g".repeat(64)}`,
					},
				],
			}),
		).toMatchObject({
			ok: false,
		});

		const wrongSecretHeader = createStripeSignatureHeader({
			secret: "wrong",
			timestamp,
			rawBody: body(),
		});
		expect(
			await provider.verify({
				...validDelivery,
				headers: [{ name: "stripe-signature", value: wrongSecretHeader }],
			}),
		).toMatchObject({
			ok: false,
		});

		const mutated = `${body()}\n`;
		expect(
			await provider.verify({
				...validDelivery,
				rawBody: new TextEncoder().encode(mutated),
			}),
		).toMatchObject({ ok: false });

		const endpoint = createWebhookEndpoint({
			provider,
			now: () => new Date((timestamp + 301) * 1000),
			handlers: { "invoice.paid": vi.fn() },
		});
		expect((await endpoint.handleWithResult(request())).result.reason).toBe(
			"stale_signed_timestamp",
		);
	});

	it("accepts any matching v1 signature among multiple signatures", async () => {
		const rawBody = body();
		const header = createStripeSignatureHeader({
			secret,
			timestamp,
			rawBody,
			extraSignatures: ["0000000000000000000000000000000000000000000000000000000000000000"],
		});

		const endpoint = createWebhookEndpoint({
			provider: stripe({ signingSecret: secret }),
			now: () => new Date(timestamp * 1000),
			handlers: { "invoice.paid": vi.fn() },
		});

		expect((await endpoint.handleWithResult(request(rawBody, header))).response.status).toBe(200);
	});

	it("extracts unknown events for catch-all handling", async () => {
		const catchAll = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: stripe({ signingSecret: secret }),
			now: () => new Date(timestamp * 1000),
			handlers: { "*": catchAll },
		});

		const result = await endpoint.handleWithResult(
			request(body("radar.early_fraud_warning.created")),
		);

		expect(result.response.status).toBe(200);
		expect(catchAll.mock.calls[0]?.[0].event.known).toBe(false);
	});

	it("uses Stripe event ids for idempotency", async () => {
		const handler = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: stripe({ signingSecret: secret }),
			endpointIdentity: "stripe-main",
			idempotencyStore: createMemoryIdempotencyStore(),
			now: () => new Date(timestamp * 1000),
			handlers: { "invoice.paid": handler },
		});

		expect((await endpoint.handleWithResult(request())).result.status).toBe("handled");
		expect((await endpoint.handleWithResult(request())).result.status).toBe("duplicate");
		expect(handler).toHaveBeenCalledOnce();
	});

	it("creates replay keys from timestamp, signature, and exact body digest", () => {
		const key = createStripeReplayKey(timestamp, "abc", new TextEncoder().encode(body()));
		expect(key).toContain(`t=${timestamp}:v1=abc:body=`);
	});

	it("narrows known handlers and exposes unknown fallback types", () => {
		createWebhookEndpoint({
			provider: stripe({ signingSecret: secret }),
			handlers: {
				"invoice.paid": ({ event }) => {
					expectTypeOf(event.payload.status).toEqualTypeOf<string | undefined>();
				},
				"*": ({ event }) => {
					expectTypeOf(event).toEqualTypeOf<StripeWebhookEvent>();
				},
			},
		});

		expectTypeOf<
			Extract<StripeWebhookEvent, UnknownStripeEvent>["payload"]
		>().toEqualTypeOf<unknown>();
	});
});
