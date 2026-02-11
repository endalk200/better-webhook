import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { toHono, toHonoNode } from "./index.js";
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
  type VerifyRawBody = Parameters<Provider<"test">["verify"]>[0];

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
    verify(_rawBody: VerifyRawBody, _headers: Headers, _secret: string): boolean {
      return options?.verifyResult ?? true;
    },
  };
}

function createRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Request {
  const { method = "POST", headers = {}, body = "" } = options;

  if (method === "GET" || method === "HEAD") {
    return new Request("http://localhost/webhooks", { method, headers });
  }

  return new Request("http://localhost/webhooks", {
    method,
    headers,
    body,
  });
}

const validPayload = { action: "created", data: { id: 1 } };

// ============================================================================
// toHono Tests
// ============================================================================

describe("toHono", () => {
  describe("method handling", () => {
    it("should reject non-POST requests with 405", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const app = new Hono();
      app.all("/webhooks", toHono(webhook));

      const request = createRequest({ method: "GET" });
      const response = await app.request(request);

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
      const body = await response.json();
      expect(body.error).toBe("Method not allowed");
    });
  });

  describe("body handling", () => {
    it("should accept a valid JSON body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

      expect(response.status).toBe(200);
    });

    it("should return 400 for invalid JSON body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: "not valid json",
      });
      const response = await app.request(request);

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing body", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      const request = new Request("http://localhost/webhooks", {
        method: "POST",
        headers: { "x-test-event": "test.event" },
      });
      const response = await app.request(request);

      expect(response.status).toBe(400);
    });

    it("should recover the raw body after middleware consumes it", async () => {
      const provider = createTestProvider();
      const handler = vi.fn();
      const webhook = createWebhook(provider).event(testEvent, handler);
      const app = new Hono();

      app.use("/webhooks", async (c, next) => {
        await c.req.text();
        await next();
      });
      app.post("/webhooks", toHono(webhook));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("response mapping", () => {
    it("should return 204 for events without handlers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      const request = createRequest({
        headers: { "x-test-event": "unknown.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

      expect(response.status).toBe(204);
    });

    it("should return 401 when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { secret: "test" }));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

      expect(response.status).toBe(401);
    });

    it("should return 200 with JSON body on success", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    it("should return 500 when handler throws", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {
        throw new Error("Handler error");
      });
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

      expect(response.status).toBe(500);
    });

    it("should return 500 JSON when webhook processing throws unexpectedly", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const processSpy = vi
        .spyOn(webhook, "process")
        .mockRejectedValue(new Error("Unexpected process failure"));
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      try {
        const request = createRequest({
          headers: { "x-test-event": "test.event" },
          body: JSON.stringify(validPayload),
        });
        const response = await app.request(request);

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe("Internal server error");
      } finally {
        processSpy.mockRestore();
      }
    });
  });

  describe("options", () => {
    it("should pass secret to webhook processor", async () => {
      const provider = createTestProvider();
      const verifySpy = vi.spyOn(provider, "verify");
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { secret: "my-secret" }));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await app.request(request);

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
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { onSuccess }));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await app.request(request);

      expect(onSuccess).toHaveBeenCalledWith("test.event");
    });

    it("should not call onSuccess on 204 responses", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const onSuccess = vi.fn();
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { onSuccess }));

      const request = createRequest({
        headers: { "x-test-event": "unknown" },
        body: JSON.stringify(validPayload),
      });
      await app.request(request);

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should not call onSuccess on error responses", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onSuccess = vi.fn();
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { secret: "test", onSuccess }));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await app.request(request);

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("observer option", () => {
    it("should call observer callbacks when observer option is provided", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { observer: { onCompleted } }));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

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
      const app = new Hono();
      app.post(
        "/webhooks",
        toHono(webhook, {
          observer: [
            { onCompleted: onCompleted1 },
            { onCompleted: onCompleted2 },
          ],
        }),
      );

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });
      await app.request(request);

      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });

    it("should call observer callbacks for unhandled events (204)", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);
      const onCompleted = vi.fn();
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { observer: { onCompleted } }));

      const request = createRequest({
        headers: { "x-test-event": "unknown.event" },
        body: JSON.stringify(validPayload),
      });
      const response = await app.request(request);

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
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const app = new Hono();
      app.post("/webhooks", toHono(webhook, { observer: { onCompleted } }));

      const request = createRequest({
        headers: { "x-test-event": "test.event" },
        body: JSON.stringify(validPayload),
      });

      await app.request(request);

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(200);
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it("should not call observer when adapter rejects before processing", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});
      const onCompleted = vi.fn();
      const app = new Hono();
      app.all("/webhooks", toHono(webhook, { observer: { onCompleted } }));

      const request = createRequest({ method: "GET" });
      const response = await app.request(request);

      expect(response.status).toBe(405);
      expect(onCompleted).not.toHaveBeenCalled();
    });
  });

  describe("header normalization", () => {
    it("should handle headers case-insensitively", async () => {
      const provider = createTestProvider();
      const handler = vi.fn();
      const webhook = createWebhook(provider).event(testEvent, handler);
      const app = new Hono();
      app.post("/webhooks", toHono(webhook));

      const request = createRequest({
        headers: {
          "X-Test-Event": "test.event",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validPayload),
      });
      await app.request(request);

      expect(handler).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// toHonoNode Tests
// ============================================================================

describe("toHonoNode", () => {
  it("should process requests like toHono", async () => {
    const provider = createTestProvider();
    const webhook = createWebhook(provider).event(testEvent, () => {});
    const app = new Hono();
    app.post("/webhooks", toHonoNode(webhook));

    const request = createRequest({
      headers: { "x-test-event": "test.event" },
      body: JSON.stringify(validPayload),
    });
    const response = await app.request(request);

    expect(response.status).toBe(200);
  });

  it("should return 405 for non-POST requests", async () => {
    const provider = createTestProvider();
    const webhook = createWebhook(provider).event(testEvent, () => {});
    const app = new Hono();
    app.all("/webhooks", toHonoNode(webhook));

    const request = createRequest({ method: "GET" });
    const response = await app.request(request);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    const body = await response.json();
    expect(body.error).toBe("Method not allowed");
  });
});
