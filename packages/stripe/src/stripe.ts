import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
	ProviderDefinition,
	RawHeaderValue,
	WebhookDelivery,
	WebhookEvent,
} from "@better-webhook/core";

export type StripeObject = {
	id?: string;
	object?: string;
	[key: string]: unknown;
};

export type StripeEventEnvelope<TType extends string = string, TData = StripeObject> = {
	id: string;
	object: "event";
	type: TType;
	created: number;
	data: {
		object: TData;
		previous_attributes?: Record<string, unknown>;
	};
	livemode?: boolean;
	api_version?: string;
	pending_webhooks?: number;
	request?: Record<string, unknown> | null;
};

export type StripeCheckoutSession = StripeObject & {
	object: "checkout.session";
	payment_status?: string;
	customer?: string | null;
};

export type StripeInvoice = StripeObject & {
	object: "invoice";
	status?: string;
	customer?: string | null;
	subscription?: string | null;
};

export type StripeSubscription = StripeObject & {
	object: "subscription";
	status?: string;
	customer?: string | null;
};

export type StripePaymentIntent = StripeObject & {
	object: "payment_intent";
	amount?: number;
	currency?: string;
	status?: string;
};

export type StripeEventPayloads = {
	"checkout.session.completed": StripeCheckoutSession;
	"checkout.session.expired": StripeCheckoutSession;
	"invoice.paid": StripeInvoice;
	"invoice.payment_failed": StripeInvoice;
	"customer.subscription.created": StripeSubscription;
	"customer.subscription.updated": StripeSubscription;
	"customer.subscription.deleted": StripeSubscription;
	"payment_intent.succeeded": StripePaymentIntent;
	"payment_intent.payment_failed": StripePaymentIntent;
};

export type KnownStripeEventType = keyof StripeEventPayloads;

export type KnownStripeEvent = {
	[TType in KnownStripeEventType]: WebhookEvent<
		TType,
		StripeEventPayloads[TType],
		StripeEventEnvelope<TType, StripeEventPayloads[TType]>
	> & {
		known: true;
	};
}[KnownStripeEventType];

export type UnknownStripeEvent = WebhookEvent<
	string,
	unknown,
	StripeEventEnvelope<string, unknown>
> & {
	known: false;
};

export type StripeWebhookEvent = KnownStripeEvent | UnknownStripeEvent;

export type StripeProviderOptions = {
	signingSecret: string;
};

export function stripe(options: StripeProviderOptions): ProviderDefinition<StripeWebhookEvent> {
	if (typeof options.signingSecret !== "string" || options.signingSecret.length === 0) {
		throw new Error("Stripe Provider Secret is required");
	}

	return {
		name: "stripe",
		capabilities: {
			signedTimestamp: true,
			replayKey: true,
		},
		verify(delivery) {
			const header = getStripeSignatureHeader(delivery.headers);
			if (!header) {
				return { ok: false, reason: "missing_stripe_signature" };
			}
			const parsed = parseStripeSignatureHeader(header);
			if (!parsed.timestamp || parsed.signatures.length === 0) {
				return { ok: false, reason: "invalid_stripe_signature_header" };
			}

			const expected = computeStripeSignature(
				options.signingSecret,
				parsed.timestamp,
				delivery.rawBody,
			);
			const matchedSignature = parsed.signatures.find((signature) =>
				secureEqualHex(signature, expected),
			);
			if (!matchedSignature) {
				return { ok: false, reason: "invalid_stripe_signature" };
			}

			return {
				ok: true,
				signedTimestamp: new Date(parsed.timestamp * 1000),
				signatureId: matchedSignature,
				replayKey: createStripeReplayKey(parsed.timestamp, matchedSignature, delivery.rawBody),
			};
		},
		extractEvent(delivery) {
			const envelope = parseStripeEnvelope(delivery);
			return {
				id: envelope.id,
				type: envelope.type,
				payload: envelope.data.object,
				envelope,
				createdAt: new Date(envelope.created * 1000),
				known: isKnownStripeEventType(envelope.type),
			} as StripeWebhookEvent;
		},
	};
}

export function parseStripeSignatureHeader(header: string): {
	timestamp?: number;
	signatures: string[];
} {
	const parts = header.split(",");
	const signatures: string[] = [];
	let timestamp: number | undefined;

	for (const part of parts) {
		const [key, value] = part.split("=", 2);
		if (!(key && value)) {
			continue;
		}
		if (key.trim() === "t") {
			const parsed = Number(value);
			if (Number.isInteger(parsed)) {
				timestamp = parsed;
			}
		}
		if (key.trim() === "v1") {
			signatures.push(value.trim());
		}
	}

	return { timestamp, signatures };
}

export function computeStripeSignature(
	secret: string,
	timestamp: number,
	rawBody: Uint8Array,
): string {
	const timestampBytes = new TextEncoder().encode(`${timestamp}.`);
	const payload = new Uint8Array(timestampBytes.length + rawBody.length);
	payload.set(timestampBytes, 0);
	payload.set(rawBody, timestampBytes.length);
	return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createStripeSignatureHeader(options: {
	secret: string;
	timestamp: number;
	rawBody: Uint8Array | string;
	extraSignatures?: string[];
}): string {
	const rawBody =
		typeof options.rawBody === "string"
			? new TextEncoder().encode(options.rawBody)
			: options.rawBody;
	const signature = computeStripeSignature(options.secret, options.timestamp, rawBody);
	return [
		`t=${options.timestamp}`,
		`v1=${signature}`,
		...(options.extraSignatures ?? []).map((value) => `v1=${value}`),
	].join(",");
}

export function createStripeReplayKey(
	timestamp: number,
	signature: string,
	rawBody: Uint8Array,
): string {
	const digest = createHash("sha256").update(rawBody).digest("hex");
	return `t=${timestamp}:v1=${signature}:body=${digest}`;
}

function getStripeSignatureHeader(headers: RawHeaderValue[]): string {
	return getHeaderValues(headers, "stripe-signature").join(",");
}

function getHeaderValues(headers: RawHeaderValue[], name: string): string[] {
	const lowerName = name.toLowerCase();
	return headers
		.filter((header) => header.name.toLowerCase() === lowerName)
		.map((header) => header.value);
}

function parseStripeEnvelope(delivery: WebhookDelivery): StripeEventEnvelope<string, unknown> {
	const decoded = new TextDecoder().decode(delivery.rawBody);
	const parsed: unknown = JSON.parse(decoded);

	if (!isRecord(parsed)) {
		throw new Error("Stripe event envelope must be an object");
	}
	if (typeof parsed.id !== "string" || parsed.id.length === 0) {
		throw new Error("Stripe event id is required");
	}
	if (parsed.object !== "event") {
		throw new Error("Stripe event object must be event");
	}
	if (typeof parsed.type !== "string" || parsed.type.length === 0) {
		throw new Error("Stripe event type is required");
	}
	if (typeof parsed.created !== "number") {
		throw new Error("Stripe event created timestamp is required");
	}
	if (!(isRecord(parsed.data) && "object" in parsed.data)) {
		throw new Error("Stripe event data.object is required");
	}

	return parsed as StripeEventEnvelope<string, unknown>;
}

function isKnownStripeEventType(type: string): type is KnownStripeEventType {
	return [
		"checkout.session.completed",
		"checkout.session.expired",
		"invoice.paid",
		"invoice.payment_failed",
		"customer.subscription.created",
		"customer.subscription.updated",
		"customer.subscription.deleted",
		"payment_intent.succeeded",
		"payment_intent.payment_failed",
	].includes(type);
}

function secureEqualHex(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left, "hex");
	const rightBuffer = Buffer.from(right, "hex");
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
