import type {
	RawDeliveryRequest,
	RawHeaderCapabilities,
	WebhookEndpoint,
	WebhookResponse,
} from "@better-webhook/core";

export type NextWebhookRequest = {
	method: string;
	url: string;
	headers: Headers;
	arrayBuffer(): Promise<ArrayBuffer>;
	signal?: AbortSignal;
};

export const nextjsRawHeaderCapabilities: RawHeaderCapabilities = {
	preservesRawBodyBytes: true,
	preservesDuplicateHeaders: false,
	notes:
		"Next.js route handlers expose Fetch Headers, which preserve signature-relevant values but not duplicate raw header lines.",
};

export function toRawDeliveryRequest(request: NextWebhookRequest): RawDeliveryRequest {
	return {
		method: request.method,
		url: request.url,
		headers: [...request.headers.entries()].map(([name, value]) => ({
			name,
			value,
		})),
		body: async () => new Uint8Array(await request.arrayBuffer()),
		signal: request.signal,
	};
}

export function toNextResponse(response: WebhookResponse): Response {
	const headers = new Headers();
	for (const header of response.headers) {
		headers.append(header.name, header.value);
	}
	return new Response(response.body, {
		status: response.status,
		headers,
	});
}

export function createNextRouteHandler(
	endpoint: WebhookEndpoint,
): (request: NextWebhookRequest) => Promise<Response> {
	return async (request) => toNextResponse(await endpoint.handle(toRawDeliveryRequest(request)));
}
