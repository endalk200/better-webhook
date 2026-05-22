import {
	createMemoryIdempotencyStore,
	createMemoryReplayStore,
	createWebhookEndpoint,
} from "@better-webhook/core";
import { toNextResponse, toRawDeliveryRequest } from "@better-webhook/nextjs";
import { otel } from "@better-webhook/otel";
import {
	type StripeCheckoutSession,
	type StripeInvoice,
	type StripeWebhookEvent,
	stripe,
} from "@better-webhook/stripe";
import { trace } from "@opentelemetry/api";

import { stripeConfig } from "../../../../src/providers/stripe/config.js";
import { startTelemetry } from "../../../../src/telemetry.js";

export const runtime = "nodejs";

const stripeEndpoint = createWebhookEndpoint<StripeWebhookEvent>({
	catchAllHandlerScope: "unknown",
	endpointIdentity: stripeConfig.endpointIdentity,
	handlers: {
		"checkout.session.completed": ({ event }) => {
			const session = event.payload as StripeCheckoutSession;
			console.log(
				`[example:nextjs:stripe] handled checkout.session.completed event=${event.id} session=${session.id ?? "unknown"} payment_status=${session.payment_status ?? "unknown"}`,
			);
		},
		"invoice.paid": ({ event }) => {
			const invoice = event.payload as StripeInvoice;
			console.log(
				`[example:nextjs:stripe] handled invoice.paid event=${event.id} invoice=${invoice.id ?? "unknown"} status=${invoice.status ?? "unknown"}`,
			);
		},
		"invoice.payment_failed": ({ event }) => {
			console.log(
				`[example:nextjs:stripe] failing invoice.payment_failed event=${event.id} so the provider can retry`,
			);
			throw new Error("Intentional Next.js Stripe example handler failure");
		},
		"*": ({ event }) => {
			console.log(
				`[example:nextjs:stripe] catch-all handled unknown verified event=${event.id} type=${event.type}`,
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
		tracer: trace.getTracer("better-webhook-example-nextjs-stripe"),
	}),
});

export async function POST(request: Request): Promise<Response> {
	startTelemetry();

	const { response, result } = await stripeEndpoint.handleWithResult(toRawDeliveryRequest(request));

	console.log(
		`[example:nextjs:stripe] delivery result status=${result.status} event=${result.eventType ?? "unknown"} id=${result.eventId ?? "none"} response=${response.status}`,
	);

	return toNextResponse(response);
}
