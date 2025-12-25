import { describe, it, expect, vi, beforeEach } from "vitest";
import { toNestJS, type NestJSRequest } from "./index.js";
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
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: Buffer | string;
}): NestJSRequest {
  return {
    headers: options.headers || {},
    body: options.body,
    rawBody: options.rawBody,
  };
}

const validPayload = { action: "created", data: { id: 1 } };

// ============================================================================
// toNestJS Tests
// ============================================================================

describe("toNestJS", () => {
  describe("body handling", () => {
    it("should prefer rawBody when available", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        body: { different: "data" },
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(200);
    });

    it("should accept Buffer body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(200);
    });

    it("should accept string body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(200);
    });

    it("should stringify parsed object body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: validPayload, // Already parsed
      });

      const result = await handler(req);

      // Note: This may fail signature verification in real scenarios
      // but should at least process without error
      expect(result.statusCode).toBe(200);
    });

    it("should return 400 for missing body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: undefined,
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(400);
      expect(result.body?.error).toContain("required");
    });
  });

  describe("response mapping", () => {
    it("should return 204 with no body for events without handlers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "unknown" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeUndefined();
    });

    it("should return 401 when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNestJS(webhook, { secret: "test" });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(401);
    });

    it("should return 200 with body on success", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(200);
      expect(result.body?.ok).toBe(true);
    });
  });

  describe("options", () => {
    it("should call onSuccess callback on successful processing", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onSuccess = vi.fn();
      const handler = toNestJS(webhook, { onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      await handler(req);

      expect(onSuccess).toHaveBeenCalledWith("test.event");
    });

    it("should not call onSuccess on 204 responses", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const onSuccess = vi.fn();
      const handler = toNestJS(webhook, { onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "unknown" },
        rawBody: JSON.stringify(validPayload),
      });

      await handler(req);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should not call onSuccess on error responses", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onSuccess = vi.fn();
      const handler = toNestJS(webhook, { secret: "test", onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      await handler(req);

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("handler execution", () => {
    it("should execute handlers and return 500 on error", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {
        throw new Error("Handler error");
      });
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(500);
    });
  });
});
