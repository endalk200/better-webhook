import { describe, it, expect, vi, beforeEach } from "vitest";
import { toNextJS } from "./index.js";
import {
  createWebhook,
  createInMemoryReplayStore,
  defineEvent,
  z,
  type Provider,
  type Headers,
} from "@better-webhook/core";

// ============================================================================
// Test Utilities
// ============================================================================

const TestSchema = z.object({
  action: z.string(),
  data: z.object({ id: z.number() }),
});

const testEvent = defineEvent({
  name: "test.event",
  schema: TestSchema,
  provider: "test" as const,
});

function createTestProvider(options?: {
  secret?: string;
  verifyResult?: boolean;
}): Provider<"test"> {
  return {
    name: "test",
    secret: options?.secret ?? "test-secret",
    verification: "required",
    getEventType(headers: Headers) {
      return headers["x-test-event"];
    },
    getDeliveryId(headers: Headers) {
      return headers["x-test-delivery-id"];
    },
    verify() {
      return options?.verifyResult ?? true;
    },
  };
}

function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Request {
  const { method = "POST", headers = {}, body = "" } = options;

  // GET/HEAD requests cannot have a body
  if (method === "GET" || method === "HEAD") {
    return new Request("http://localhost/webhook", {
      method,
      headers,
    });
  }

  return new Request("http://localhost/webhook", {
    method,
    headers,
    body,
  });
}

const validPayload = { action: "created", data: { id: 1 } };

// ============================================================================
// toNextJS Tests
// ============================================================================

describe("toNextJS", () => {
  describe("method handling", () => {
    it("should reject non-POST requests with 405", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toNextJS(webhook);

      const request = createMockRequest({ method: "GET" });
      const response = await handler(request);

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      const body = await response.json();
      expect(body.error).toBe("Method not allowed");
    });

    it("should accept POST requests", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toNextJS(webhook);

      const request = createMockRequest({
        method: "POST",
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(200);
    });
  });

  describe("response mapping", () => {
    it("should return 204 with no body for events without handlers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const handler = toNextJS(webhook);

      const request = createMockRequest({
        headers: { "x-test-event": "unknown.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(204);
    });

    it("should return 401 when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toNextJS(webhook, { secret: "test" });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(401);
    });

    it("should return 200 with JSON body on success", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toNextJS(webhook);

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    it("should return 409 for duplicate deliveries when replay protection is enabled", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const processSpy = vi.spyOn(webhook, "process");
      processSpy.mockResolvedValueOnce({
        status: 200,
        eventType: "test.event",
        body: { ok: true },
      });
      processSpy.mockResolvedValueOnce({
        status: 409,
        eventType: "test.event",
        body: { ok: false, error: "Duplicate webhook delivery" },
      });
      const handler = toNextJS(webhook);

      const firstRequest = createMockRequest({
        headers: {
          "x-test-event": "test.event",
          "x-test-delivery-id": "delivery-duplicate",
        },
        body: JSON.stringify(validPayload),
      });

      const firstResponse = await handler(firstRequest);
      expect(firstResponse.status).toBe(200);

      const secondRequest = createMockRequest({
        headers: {
          "x-test-event": "test.event",
          "x-test-delivery-id": "delivery-duplicate",
        },
        body: JSON.stringify(validPayload),
      });
      const secondResponse = await handler(secondRequest);
      expect(secondResponse.status).toBe(409);
    });

    it("should enforce replay protection with a real replay store", async () => {
      const provider = createTestProvider();
      const eventHandler = vi.fn();
      const webhook = createWebhook(provider)
        .withReplayProtection({ store: createInMemoryReplayStore() })
        .event(testEvent, eventHandler);
      const handler = toNextJS(webhook);

      const firstRequest = createMockRequest({
        headers: {
          "x-test-event": "test.event",
          "x-test-delivery-id": "delivery-real-store",
        },
        body: JSON.stringify(validPayload),
      });
      const secondRequest = createMockRequest({
        headers: {
          "x-test-event": "test.event",
          "x-test-delivery-id": "delivery-real-store",
        },
        body: JSON.stringify(validPayload),
      });

      const firstResponse = await handler(firstRequest);
      const secondResponse = await handler(secondRequest);

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(409);
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("options", () => {
    it("should pass secret to webhook processor", async () => {
      const provider = createTestProvider();
      const verifySpy = vi.spyOn(provider, "verify");
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toNextJS(webhook, { secret: "my-secret" });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await handler(request);

      expect(verifySpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "my-secret",
      );
    });

    it("should call onSuccess callback on successful processing", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const handler = toNextJS(webhook, { onSuccess });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await handler(request);

      expect(onSuccess).toHaveBeenCalledWith("test.event");
    });

    it("should not call onSuccess on 204 responses", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const onSuccess = vi.fn();
      const handler = toNextJS(webhook, { onSuccess });

      const request = createMockRequest({
        headers: { "x-test-event": "unknown" },
        body: JSON.stringify(validPayload),
      });
      await handler(request);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should not call onSuccess on error responses", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const handler = toNextJS(webhook, { secret: "test", onSuccess });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await handler(request);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should return 413 and not call onSuccess when body exceeds maxBodyBytes", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const handler = toNextJS(webhook, { maxBodyBytes: 10, onSuccess });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(413);
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("observer option", () => {
    it("should call observer callbacks when observer option is provided", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const handler = toNextJS(webhook, { observer: { onCompleted } });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "completed",
          status: 200,
          success: true,
          eventType: "test.event",
        }),
      );
    });

    it("should accept an array of observers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted1 = vi.fn();
      const onCompleted2 = vi.fn();
      const handler = toNextJS(webhook, {
        observer: [
          { onCompleted: onCompleted1 },
          { onCompleted: onCompleted2 },
        ],
      });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });

    it("should call observer callbacks for unhandled events (204)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider); // no handlers
      const onCompleted = vi.fn();
      const handler = toNextJS(webhook, { observer: { onCompleted } });

      const request = createMockRequest({
        headers: { "x-test-event": "unknown.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await handler(request);

      expect(response.status).toBe(204);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "completed",
          status: 204,
          success: false,
        }),
      );
    });

    it("should not mutate original webhook when observer is provided", async () => {
      const provider = createTestProvider();
      const onCompleted = vi.fn();
      const webhook = createWebhook(provider).event(testEvent, () => {});

      const handler = toNextJS(webhook, { observer: { onCompleted } });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });

      await handler(request);

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(200);
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
  });

  describe("header normalization", () => {
    it("should normalize headers to lowercase", async () => {
      const provider = createTestProvider();
      const handler = vi.fn();
      const webhook = createWebhook(provider).event(testEvent, handler);
      const nextHandler = toNextJS(webhook);

      const request = createMockRequest({
        headers: {
          "X-Test-Event": "test.event",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      });
      await nextHandler(request);

      expect(handler).toHaveBeenCalled();
    });
  });
});
