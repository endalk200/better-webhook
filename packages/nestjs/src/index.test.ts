import { describe, it, expect, vi } from "vitest";
import { toNestJS, type NestJSRequest } from "./index.js";
import {
  createWebhook,
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toNestJS(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(200);
      expect(result.body?.ok).toBe(true);
    });

    it("should pass through 409 status from process() (for duplicate delivery responses)", async () => {
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
      const handler = toNestJS(webhook);
      const createDuplicateReq = () =>
        createMockRequest({
          headers: {
            "x-test-event": "test.event",
            "x-test-delivery-id": "delivery-duplicate",
          },
          rawBody: JSON.stringify(validPayload),
        });

      try {
        const firstResult = await handler(createDuplicateReq());
        expect(firstResult.statusCode).toBe(200);

        const secondResult = await handler(createDuplicateReq());
        expect(secondResult.statusCode).toBe(409);
      } finally {
        processSpy.mockRestore();
      }
    });
  });

  describe("options", () => {
    it("should call onSuccess callback on successful processing", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
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
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const handler = toNestJS(webhook, { secret: "test", onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      await handler(req);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should return 413 and not call onSuccess when body exceeds maxBodyBytes", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const handler = toNestJS(webhook, { maxBodyBytes: 10, onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(413);
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("handler execution", () => {
    it("should execute handlers and return 500 on error", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {
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

  describe("observer option", () => {
    it("should call observer callbacks when observer option is provided", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const handler = toNestJS(webhook, { observer: { onCompleted } });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(200);
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
      const handler = toNestJS(webhook, {
        observer: [
          { onCompleted: onCompleted1 },
          { onCompleted: onCompleted2 },
        ],
      });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(200);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });

    it("should call observer callbacks for unhandled events (204)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider); // no handlers
      const onCompleted = vi.fn();
      const handler = toNestJS(webhook, { observer: { onCompleted } });

      const req = createMockRequest({
        headers: { "x-test-event": "unknown.event" },
        rawBody: JSON.stringify(validPayload),
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(204);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "completed",
          status: 204,
          success: true,
        }),
      );
    });

    it("should not call observer when adapter rejects before processing (missing body)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const handler = toNestJS(webhook, { observer: { onCompleted } });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: undefined,
        rawBody: undefined,
      });

      const result = await handler(req);

      expect(result.statusCode).toBe(400);
      expect(onCompleted).not.toHaveBeenCalled();
    });
  });
});
