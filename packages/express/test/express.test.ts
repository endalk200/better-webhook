import { createHmac } from "node:crypto";
import { createWebhookEndpoint } from "@better-webhook/core";
import { stripe } from "@better-webhook/stripe";
import { describe, expect, it, vi } from "vitest";
import {
	createExpressMiddleware,
	expressRawHeaderCapabilities,
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

function expressRequest(signature = createStripeSignatureHeader({ secret, timestamp, rawBody })) {
	return {
		method: "POST",
		url: "/stripe",
		headers: { "stripe-signature": signature },
		rawHeaders: ["Stripe-Signature", signature, "Stripe-Signature", "v0=legacy"],
		rawBody: Buffer.from(rawBody),
	};
}

function createStripeSignatureHeader(options: {
	secret: string;
	timestamp: number;
	rawBody: Uint8Array | string;
}): string {
	const rawBody =
		typeof options.rawBody === "string"
			? new TextEncoder().encode(options.rawBody)
			: options.rawBody;
	const timestampBytes = new TextEncoder().encode(`${options.timestamp}.`);
	const payload = new Uint8Array(timestampBytes.length + rawBody.length);
	payload.set(timestampBytes, 0);
	payload.set(rawBody, timestampBytes.length);
	const signature = createHmac("sha256", options.secret).update(payload).digest("hex");
	return `t=${options.timestamp},v1=${signature}`;
}

describe("Express adapter", () => {
	it("declares raw body and duplicate raw header support with setup caveats", () => {
		expect(expressRawHeaderCapabilities).toMatchObject({
			preservesRawBodyBytes: true,
			preservesDuplicateHeaders: true,
		});
	});

	it("requires rawBody and preserves duplicate raw headers", () => {
		expect(() => toRawDeliveryRequest({ method: "POST", url: "/stripe", headers: {} })).toThrow(
			/rawBody/,
		);

		const raw = toRawDeliveryRequest(expressRequest());
		expect(raw.headers.filter((header) => header.name === "Stripe-Signature")).toHaveLength(2);
		expect(new TextDecoder().decode(raw.body as Uint8Array)).toBe(rawBody);
	});

	it("translates successful and rejected responses without changing pipeline semantics", async () => {
		const handler = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: stripe({ signingSecret: secret }),
			now: () => new Date(timestamp * 1000),
			handlers: { "invoice.paid": handler },
		});
		const middleware = createExpressMiddleware(endpoint);
		const response = fakeResponse();

		await middleware(expressRequest(), response, vi.fn());

		expect(response.statusCode).toBe(200);
		expect(handler).toHaveBeenCalledOnce();

		const rejectedResponse = fakeResponse();
		await middleware(expressRequest("t=1,v1=bad"), rejectedResponse, vi.fn());
		expect(rejectedResponse.statusCode).toBe(400);
	});
});

function fakeResponse() {
	return {
		statusCode: 0,
		body: "",
		headers: new Map<string, string>(),
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		setHeader(name: string, value: string) {
			this.headers.set(name, value);
		},
		send(body: string) {
			this.body = body;
		},
	};
}
