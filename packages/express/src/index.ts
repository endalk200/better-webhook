import type {
  RawDeliveryRequest,
  RawHeaderCapabilities,
  WebhookEndpoint,
  WebhookResponse,
} from "@better-webhook/core";

export type ExpressWebhookRequest = {
  method: string;
  originalUrl?: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  rawHeaders?: string[];
  body?: unknown;
  rawBody?: Buffer | Uint8Array | string;
};

export type ExpressWebhookResponse = {
  status(code: number): ExpressWebhookResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

export type ExpressNextFunction = (error?: unknown) => void;

export const expressRawHeaderCapabilities: RawHeaderCapabilities = {
  preservesRawBodyBytes: true,
  preservesDuplicateHeaders: true,
  notes:
    "Express exposes duplicate raw header lines through req.rawHeaders. The raw body must be captured before parsed body middleware mutates req.body.",
};

export function toRawDeliveryRequest(
  request: ExpressWebhookRequest,
): RawDeliveryRequest {
  const body = request.rawBody;
  if (body === undefined) {
    throw new Error(
      "Express webhook requests require req.rawBody captured before parsed body middleware",
    );
  }

  return {
    method: request.method,
    url: request.originalUrl ?? request.url,
    headers: rawHeadersToPairs(request),
    body: body instanceof Buffer ? new Uint8Array(body) : body,
  };
}

export function sendExpressResponse(
  response: ExpressWebhookResponse,
  webhookResponse: WebhookResponse,
): void {
  for (const header of webhookResponse.headers)
    response.setHeader(header.name, header.value);
  response.status(webhookResponse.status).send(webhookResponse.body);
}

export function createExpressMiddleware(endpoint: WebhookEndpoint) {
  return async (
    request: ExpressWebhookRequest,
    response: ExpressWebhookResponse,
    next: ExpressNextFunction,
  ) => {
    try {
      sendExpressResponse(
        response,
        await endpoint.handle(toRawDeliveryRequest(request)),
      );
    } catch (error) {
      next(error);
    }
  };
}

function rawHeadersToPairs(
  request: ExpressWebhookRequest,
): { name: string; value: string }[] {
  if (request.rawHeaders && request.rawHeaders.length > 0) {
    const pairs: { name: string; value: string }[] = [];
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index];
      const value = request.rawHeaders[index + 1];
      if (name && value !== undefined) pairs.push({ name, value });
    }
    return pairs;
  }

  return Object.entries(request.headers).flatMap(([name, value]) => {
    if (value === undefined) return [];
    if (Array.isArray(value))
      return value.map((item) => ({ name, value: item }));
    return [{ name, value }];
  });
}
