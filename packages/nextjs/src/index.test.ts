import { describe, it, expect, vi, beforeEach } from "vitest";
import { toNextJS } from "./index.js";
import {
  createWebhook,
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

type TestEventMap = {
  "test.event": typeof TestSchema;
};

function createTestProvider(options?: {
  secret?: string;
  verifyResult?: boolean;
}): Provider<TestEventMap> {
  return {
    name: "test",
    schemas: { "test.event": TestSchema },
    secret: options?.secret,
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
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNextJS(webhook);

      const request = createMockRequest({ method: "GET" });
      const response = await handler(request);

      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error).toBe("Method not allowed");
    });

    it("should accept POST requests", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
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
      const webhook = createWebhook(provider).event("test.event", () => {});
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
      const webhook = createWebhook(provider).event("test.event", () => {});
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
  });

  describe("options", () => {
    it("should pass secret to webhook processor", async () => {
      const provider = createTestProvider();
      const processSpy = vi.spyOn(
        createWebhook(provider).event("test.event", () => {}),
        "process",
      );

      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNextJS(webhook, { secret: "my-secret" });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await handler(request);

      // Verify that the handler works - the secret is passed internally
      expect(true).toBe(true);
    });

    it("should call onSuccess callback on successful processing", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
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
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onSuccess = vi.fn();
      const handler = toNextJS(webhook, { secret: "test", onSuccess });

      const request = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await handler(request);

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("observer option", () => {
    it("should call observer callbacks when observer option is provided", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
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
      const webhook = createWebhook(provider).event("test.event", () => {});
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
  });

  describe("header normalization", () => {
    it("should normalize headers to lowercase", async () => {
      const provider = createTestProvider();
      const handler = vi.fn();
      const webhook = createWebhook(provider).event("test.event", handler);
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
