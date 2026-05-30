import { createHmac } from "node:crypto";

import { stripeConfig, stripeWebhookUrl } from "../../src/providers/stripe/config.js";

type Scenario = "checkout" | "invoice" | "unknown" | "duplicate" | "replay" | "ignored" | "failure";

const scenario = process.argv[2] as Scenario | undefined;

if (!scenario) {
	console.error(
		"Usage: bun run send:stripe:<checkout|invoice|unknown|duplicate|replay|ignored|failure>",
	);
	process.exit(1);
}

const now = Math.floor(Date.now() / 1000);

const events = {
	checkout: stripeEvent({
		dataObject: {
			id: "cs_example_checkout",
			object: "checkout.session",
			payment_status: "paid",
		},
		id: "evt_example_checkout",
		type: "checkout.session.completed",
	}),
	failure: stripeEvent({
		dataObject: {
			id: "in_example_failure",
			object: "invoice",
			status: "open",
		},
		id: "evt_example_failure",
		type: "invoice.payment_failed",
	}),
	ignored: stripeEvent({
		dataObject: {
			id: "cs_example_ignored",
			object: "checkout.session",
			payment_status: "unpaid",
		},
		id: "evt_example_ignored",
		type: "checkout.session.expired",
	}),
	invoice: stripeEvent({
		dataObject: {
			id: "in_example_paid",
			object: "invoice",
			status: "paid",
		},
		id: "evt_example_invoice",
		type: "invoice.paid",
	}),
	unknown: stripeEvent({
		dataObject: {
			id: "obj_example_unknown",
			object: "example.object",
		},
		id: "evt_example_unknown",
		type: "example.unknown",
	}),
};

if (scenario === "duplicate") {
	const event = stripeEvent({
		dataObject: {
			id: "cs_example_duplicate",
			object: "checkout.session",
			payment_status: "paid",
		},
		id: "evt_example_duplicate",
		type: "checkout.session.completed",
	});
	await sendSignedDelivery("duplicate:first", event, now);
	await sendSignedDelivery("duplicate:second", event, now + 1);
} else if (scenario === "replay") {
	const event = stripeEvent({
		dataObject: {
			id: "cs_example_replay",
			object: "checkout.session",
			payment_status: "paid",
		},
		id: "evt_example_replay",
		type: "checkout.session.completed",
	});
	const rawBody = JSON.stringify(event);
	const signature = createStripeSignatureHeader({
		rawBody,
		secret: stripeConfig.signingSecret,
		timestamp: now,
	});
	await postDelivery("replay:first", rawBody, signature);
	await postDelivery("replay:second", rawBody, signature);
} else if (scenario in events) {
	await sendSignedDelivery(scenario, events[scenario], now);
} else {
	console.error(`Unknown Delivery Scenario: ${scenario}`);
	process.exit(1);
}

function stripeEvent(options: { dataObject: Record<string, unknown>; id: string; type: string }) {
	return {
		api_version: "2025-11-17.clover",
		created: now,
		data: {
			object: options.dataObject,
		},
		id: options.id,
		livemode: false,
		object: "event",
		pending_webhooks: 1,
		request: null,
		type: options.type,
	};
}

async function sendSignedDelivery(
	label: string,
	event: Record<string, unknown>,
	timestamp: number,
): Promise<void> {
	const rawBody = JSON.stringify(event);
	const signature = createStripeSignatureHeader({
		rawBody,
		secret: stripeConfig.signingSecret,
		timestamp,
	});
	await postDelivery(label, rawBody, signature);
}

function createStripeSignatureHeader(options: {
	rawBody: Uint8Array | string;
	secret: string;
	timestamp: number;
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

async function postDelivery(label: string, rawBody: string, signature: string): Promise<void> {
	const response = await fetch(stripeWebhookUrl(), {
		body: rawBody,
		headers: {
			"content-type": "application/json",
			"stripe-signature": signature,
		},
		method: "POST",
	});
	console.log(
		`[sender:express:stripe] ${label} status=${response.status} body=${await response.text()}`,
	);
}
