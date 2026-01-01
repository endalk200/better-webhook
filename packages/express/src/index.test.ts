import { describe, it, expect, vi, beforeEach } from "vitest";
import { toExpress } from "./index.js";
import {
  createWebhook,
  z,
  type Provider,
  type Headers,
} from "@better-webhook/core";
import type { Request, Response, NextFunction } from "express";

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
  body?: Buffer | string | object;
}): Partial<Request> {
  return {
    headers: options.headers || {},
    body: options.body,
  };
}

function createMockResponse() {
  const state = {
    statusCode: null as number | null,
    jsonBody: null as unknown,
    ended: false,
  };

  const res: Partial<Response> = {
    status(code: number) {
      state.statusCode = code;
      return this as Response;
    },
    json(body: unknown) {
      state.jsonBody = body;
      return this as Response;
    },
    end() {
      state.ended = true;
      return this as Response;
    },
  };

  return { res, state };
}

const validPayload = { action: "created", data: { id: 1 } };

// ============================================================================
// toExpress Tests
// ============================================================================

describe("toExpress", () => {
  describe("body handling", () => {
    it("should accept Buffer body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const middleware = toExpress(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(200);
    });

    it("should accept string body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const middleware = toExpress(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(200);
    });

    it("should reject parsed JSON body with 400", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const middleware = toExpress(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: validPayload, // Already parsed object
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(400);
      expect((state.jsonBody as any).error).toContain("raw");
    });
  });

  describe("response mapping", () => {
    it("should return 204 and end response for events without handlers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const middleware = toExpress(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "unknown" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(204);
      expect(state.ended).toBe(true);
    });

    it("should return 401 when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event("test.event", () => {});
      const middleware = toExpress(webhook, { secret: "test" });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(401);
    });

    it("should return 200 with JSON body on success", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const middleware = toExpress(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(200);
      expect((state.jsonBody as any).ok).toBe(true);
    });
  });

  describe("options", () => {
    it("should call onSuccess callback on successful processing", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onSuccess = vi.fn();
      const middleware = toExpress(webhook, { onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(onSuccess).toHaveBeenCalledWith("test.event");
    });

    it("should not call onSuccess on error responses", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onSuccess = vi.fn();
      const middleware = toExpress(webhook, { secret: "test", onSuccess });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return 400 when body is missing (even if next is provided)", async () => {
      const provider = createTestProvider();
      // Create a webhook that will throw
      const webhook = createWebhook(provider).event("test.event", () => {});
      const middleware = toExpress(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: undefined, // This will cause an issue
      });
      const { res, state } = createMockResponse();
      const next = vi.fn();

      // Force an error by making body undefined
      (req as any).body = undefined;

      await middleware(req as Request, res as Response, next);

      // With undefined body, it should return 400
      expect(state.statusCode).toBe(400);
    });

    it("should return 500 when next is not provided and error occurs", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {
        throw new Error("Handler error");
      });
      const middleware = toExpress(webhook);

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(500);
    });
  });

  describe("observer option", () => {
    it("should call observer callbacks when observer option is provided", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onCompleted = vi.fn();
      const middleware = toExpress(webhook, {
        observer: { onCompleted },
      });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

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

    it("should call observer callbacks for unhandled events (204)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider); // no handlers
      const onCompleted = vi.fn();
      const middleware = toExpress(webhook, {
        observer: { onCompleted },
      });

      const req = createMockRequest({
        headers: { "x-test-event": "unknown.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

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

    it("should call observer callbacks for verification failures (401)", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onCompleted = vi.fn();
      const middleware = toExpress(webhook, {
        secret: "test",
        observer: { onCompleted },
      });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(401);
      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "completed",
          status: 401,
          success: false,
          eventType: "test.event",
        }),
      );
    });

    it("should not call observer when adapter rejects parsed JSON body (process not invoked)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onCompleted = vi.fn();
      const middleware = toExpress(webhook, {
        observer: { onCompleted },
      });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: validPayload, // parsed object => adapter returns 400 before calling process()
      });
      const { res, state } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(state.statusCode).toBe(400);
      expect(onCompleted).not.toHaveBeenCalled();
    });

    it("should accept an array of observers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event("test.event", () => {});
      const onCompleted1 = vi.fn();
      const onCompleted2 = vi.fn();
      const middleware = toExpress(webhook, {
        observer: [
          { onCompleted: onCompleted1 },
          { onCompleted: onCompleted2 },
        ],
      });

      const req = createMockRequest({
        headers: { "x-test-event": "test.event" },
        body: Buffer.from(JSON.stringify(validPayload)),
      });
      const { res } = createMockResponse();

      await middleware(req as Request, res as Response);

      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });
  });
});
