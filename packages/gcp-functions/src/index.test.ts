import { describe, it, expect, vi } from "vitest";
import { toGCPFunction } from "./index.js";
import {
  createWebhook,
  defineEvent,
  z,
  type Provider,
  type Headers,
} from "@better-webhook/core";
import type { GCPFunctionRequest, GCPFunctionResponse } from "./index.js";

// ============================================================================
// Test Utilities
// ============================================================================

const TestSchema = z.object({
  action: z.string(),
  data: z.object({ id: z.number() }),
});

// Define test event using new pattern
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
  body?: Buffer | string | object;
  rawBody?: Buffer;
}): GCPFunctionRequest {
  return {
    method: options.method || "POST",
    headers: options.headers || {},
    body: options.body,
    rawBody: options.rawBody,
  };
}

function createMockResponse() {
  const state = {
    statusCode: null as number | null,
    jsonBody: null as unknown,
    ended: false,
  };

  const res: GCPFunctionResponse = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.jsonBody = body;
      return this;
    },
    end() {
      state.ended = true;
      return this;
    },
    set(_header: string, _value: string) {
      return this;
    },
  };

  return { res, state };
}

const validPayload = { action: "created", data: { id: 1 } };

// ============================================================================
// toGCPFunction Tests
// ============================================================================

describe("toGCPFunction", () => {
  describe("method handling", () => {
    it("should reject non-POST requests with 405", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({ method: "GET" });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(405);
      expect((state.jsonBody as { error: string }).error).toBe(
        "Method not allowed",
      );
    });

    it("should accept POST requests", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        method: "POST",
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(200);
    });
  });

  describe("body handling", () => {
    it("should accept rawBody from Functions Framework", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: validPayload, // Parsed JSON
        rawBody: Buffer.from(JSON.stringify(validPayload)), // Raw body available
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(200);
    });

    it("should accept Buffer body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(200);
    });

    it("should accept string body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(200);
    });

    it("should handle parsed JSON body by stringifying", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: validPayload, // Already parsed object
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      // Should work but signature verification may fail in real scenarios
      expect(state.statusCode).toBe(200);
    });

    it("should return 400 for missing body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: undefined,
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(400);
      expect((state.jsonBody as { error: string }).error).toBe(
        "Request body is required",
      );
    });
  });

  describe("response mapping", () => {
    it("should return 204 and end response for events without handlers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "unknown" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(204);
      expect(state.ended).toBe(true);
    });

    it("should return 401 when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook, { secret: "test" });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(401);
    });

    it("should return 200 with JSON body on success", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(200);
      expect((state.jsonBody as { ok: boolean }).ok).toBe(true);
    });

    it("should return 400 for invalid JSON body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from("not valid json"),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(400);
    });

    it("should return 400 for schema validation failure", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify({ invalid: "payload" })),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(400);
    });
  });

  describe("options", () => {
    it("should call onSuccess callback on successful processing", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const handler = toGCPFunction(webhook, { onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res } = createMockResponse();

      await handler(req, res);

      expect(onSuccess).toHaveBeenCalledWith("test.event");
    });

    it("should not call onSuccess on 204 responses", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const onSuccess = vi.fn();
      const handler = toGCPFunction(webhook, { onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "unknown" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res } = createMockResponse();

      await handler(req, res);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should not call onSuccess on error responses", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const handler = toGCPFunction(webhook, { secret: "test", onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res } = createMockResponse();

      await handler(req, res);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should ignore errors from onSuccess callback", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn().mockRejectedValue(new Error("callback error"));
      const handler = toGCPFunction(webhook, { onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      // Should still return 200 despite callback error
      expect(state.statusCode).toBe(200);
    });
  });

  describe("error handling", () => {
    it("should return 500 when handler throws an error", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {
        throw new Error("Handler error");
      });
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(500);
    });

    it("should return 500 when async handler rejects", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, async () => {
        throw new Error("Async handler error");
      });
      const handler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(500);
    });
  });

  describe("observer option", () => {
    it("should call observer callbacks when observer option is provided", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const handler = toGCPFunction(webhook, { observer: { onCompleted } });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(200);
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
      const handler = toGCPFunction(webhook, {
        observer: [
          { onCompleted: onCompleted1 },
          { onCompleted: onCompleted2 },
        ],
      });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(200);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });

    it("should call observer callbacks for unhandled events (204)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider); // no handlers
      const onCompleted = vi.fn();
      const handler = toGCPFunction(webhook, { observer: { onCompleted } });

      const req = createMockRequest({
        headers: { "x-test-event": "unknown.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(204);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "completed",
          status: 204,
          success: false,
        }),
      );
    });

    it("should not call observer when adapter rejects before processing (missing body)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const handler = toGCPFunction(webhook, { observer: { onCompleted } });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: undefined,
      });
      const { res, state } = createMockResponse();

      await handler(req, res);

      expect(state.statusCode).toBe(400);
      expect(onCompleted).not.toHaveBeenCalled();
    });

    it("should not mutate original webhook when observer is provided", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const handler = toGCPFunction(webhook, { observer: { onCompleted } });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res } = createMockResponse();

      await handler(req, res);

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
    it("should handle headers case-insensitively", async () => {
      const provider = createTestProvider();
      const handler = vi.fn();
      const webhook = createWebhook(provider).event(testEvent, handler);
      const gcpHandler = toGCPFunction(webhook);

      const req = createMockRequest({
        headers: {
          "X-Test-Event": "test.event",
          "Content-Type": "application/json",
        },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res } = createMockResponse();

      await gcpHandler(req, res);

      expect(handler).toHaveBeenCalled();
    });
  });
});
