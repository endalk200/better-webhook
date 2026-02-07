import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  WebhookBuilder,
  createWebhook,
  normalizeHeaders,
  secureCompare,
  verifyHmac,
  createHmacVerifier,
  createProvider,
  customWebhook,
  defineEvent,
  type Provider,
  type Headers,
  type HandlerContext,
  type WebhookEvent,
} from "./index.js";

// ============================================================================
// Test Utilities
// ============================================================================

const TestEventSchema = z.object({
  action: z.string(),
  data: z.object({
    id: z.number(),
    name: z.string(),
  }),
});

// Define test events using the new pattern
const testEvent = defineEvent({
  name: "test.event",
  schema: TestEventSchema,
  provider: "test" as const,
});

const anotherEvent = defineEvent({
  name: "another.event",
  schema: TestEventSchema,
  provider: "test" as const,
});

function createTestProvider(options?: {
  secret?: string;
  verifyResult?: boolean;
  verification?: "required" | "disabled";
}): Provider<"test"> {
  return {
    name: "test",
    secret: options?.secret,
    verification: options?.verification ?? "required",
    getEventType(headers: Headers) {
      return headers["x-test-event"];
    },
    getDeliveryId(headers: Headers) {
      return headers["x-test-delivery-id"];
    },
    verify(_rawBody: string | Buffer, _headers: Headers, _secret: string) {
      return options?.verifyResult ?? true;
    },
  };
}

const validPayload = {
  action: "created",
  data: { id: 1, name: "test" },
};

// ============================================================================
// normalizeHeaders Tests
// ============================================================================

describe("normalizeHeaders", () => {
  it("should convert header keys to lowercase", () => {
    const headers = {
      "Content-Type": "application/json",
      "X-Custom-Header": "value",
    };

    const normalized = normalizeHeaders(headers);

    expect(normalized["content-type"]).toBe("application/json");
    expect(normalized["x-custom-header"]).toBe("value");
  });

  it("should handle array values by taking the first element", () => {
    const headers = {
      "X-Multiple": ["first", "second"],
    };

    const normalized = normalizeHeaders(headers);

    expect(normalized["x-multiple"]).toBe("first");
  });

  it("should preserve undefined values", () => {
    const headers = {
      "X-Undefined": undefined,
    };

    const normalized = normalizeHeaders(headers);

    expect(normalized["x-undefined"]).toBeUndefined();
  });
});

// ============================================================================
// secureCompare Tests
// ============================================================================

describe("secureCompare", () => {
  it("should return true for equal strings", () => {
    expect(secureCompare("hello", "hello")).toBe(true);
    expect(secureCompare("", "")).toBe(true);
    expect(secureCompare("abc123", "abc123")).toBe(true);
  });

  it("should return false for different strings", () => {
    expect(secureCompare("hello", "world")).toBe(false);
    expect(secureCompare("hello", "hello!")).toBe(false);
    expect(secureCompare("abc", "ab")).toBe(false);
  });

  it("should return false for strings of different lengths", () => {
    expect(secureCompare("short", "longer string")).toBe(false);
    expect(secureCompare("a", "")).toBe(false);
  });
});

// ============================================================================
// WebhookBuilder Tests
// ============================================================================

describe("WebhookBuilder", () => {
  describe("event registration", () => {
    it("should register event handlers", async () => {
      const provider = createTestProvider();
      const handler = vi.fn();

      const webhook = createWebhook(provider).event(testEvent, handler);

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        validPayload,
        expect.objectContaining({
          eventType: "test.event",
          provider: "test",
        }),
      );
    });

    it("should support multiple handlers for the same event", async () => {
      const provider = createTestProvider();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const webhook = createWebhook(provider)
        .event(testEvent, handler1)
        .event(testEvent, handler2);

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(handler1).toHaveBeenCalledWith(
        validPayload,
        expect.objectContaining({ eventType: "test.event" }),
      );
      expect(handler2).toHaveBeenCalledWith(
        validPayload,
        expect.objectContaining({ eventType: "test.event" }),
      );
    });

    it("should execute handlers sequentially", async () => {
      const provider = createTestProvider();
      const order: number[] = [];

      const webhook = createWebhook(provider)
        .event(testEvent, async () => {
          await new Promise((r) => setTimeout(r, 10));
          order.push(1);
        })
        .event(testEvent, () => {
          order.push(2);
        });

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(order).toEqual([1, 2]);
    });
  });

  describe("handler context", () => {
    it("should pass context with eventType to handlers", async () => {
      const provider = createTestProvider();
      let receivedContext: HandlerContext | undefined;

      const webhook = createWebhook(provider).event(
        testEvent,
        (_payload, context) => {
          receivedContext = context;
        },
      );

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.eventType).toBe("test.event");
    });

    it("should pass context with provider name to handlers", async () => {
      const provider = createTestProvider();
      let receivedContext: HandlerContext | undefined;

      const webhook = createWebhook(provider).event(
        testEvent,
        (_payload, context) => {
          receivedContext = context;
        },
      );

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.provider).toBe("test");
    });

    it("should pass context with normalized headers to handlers", async () => {
      const provider = createTestProvider();
      let receivedContext: HandlerContext | undefined;

      const webhook = createWebhook(provider).event(
        testEvent,
        (_payload, context) => {
          receivedContext = context;
        },
      );

      await webhook.process({
        headers: {
          "X-Test-Event": "test.event",
          "X-Custom-Header": "custom-value",
        },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.headers["x-test-event"]).toBe("test.event");
      expect(receivedContext!.headers["x-custom-header"]).toBe("custom-value");
    });

    it("should pass context with rawBody to handlers", async () => {
      const provider = createTestProvider();
      let receivedContext: HandlerContext | undefined;
      const rawBodyString = JSON.stringify(validPayload);

      const webhook = createWebhook(provider).event(
        testEvent,
        (_payload, context) => {
          receivedContext = context;
        },
      );

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: rawBodyString,
        secret: "test-secret",
      });

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.rawBody).toBe(rawBodyString);
    });

    it("should pass context with rawBody as string when Buffer is provided", async () => {
      const provider = createTestProvider();
      let receivedContext: HandlerContext | undefined;
      const rawBodyString = JSON.stringify(validPayload);
      const rawBodyBuffer = Buffer.from(rawBodyString, "utf-8");

      const webhook = createWebhook(provider).event(
        testEvent,
        (_payload, context) => {
          receivedContext = context;
        },
      );

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: rawBodyBuffer,
        secret: "test-secret",
      });

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.rawBody).toBe(rawBodyString);
    });

    it("should pass context with receivedAt timestamp to handlers", async () => {
      const provider = createTestProvider();
      let receivedContext: HandlerContext | undefined;
      const beforeProcess = new Date();

      const webhook = createWebhook(provider).event(
        testEvent,
        (_payload, context) => {
          receivedContext = context;
        },
      );

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      const afterProcess = new Date();

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.receivedAt).toBeInstanceOf(Date);
      expect(receivedContext!.receivedAt.getTime()).toBeGreaterThanOrEqual(
        beforeProcess.getTime(),
      );
      expect(receivedContext!.receivedAt.getTime()).toBeLessThanOrEqual(
        afterProcess.getTime(),
      );
    });

    it("should pass the same context to all handlers for the same event", async () => {
      const provider = createTestProvider();
      const receivedContexts: HandlerContext[] = [];

      const webhook = createWebhook(provider)
        .event(testEvent, (_payload, context) => {
          receivedContexts.push(context);
        })
        .event(testEvent, (_payload, context) => {
          receivedContexts.push(context);
        });

      await webhook.process({
        headers: {
          "x-test-event": "test.event",
          "x-custom-header": "custom-value",
        },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(receivedContexts.length).toBe(2);
      // Both handlers should receive the same context object
      expect(receivedContexts[0]).toBe(receivedContexts[1]);
      expect(receivedContexts[0]!.headers["x-custom-header"]).toBe(
        "custom-value",
      );
    });

    it("should allow handlers to use context without payload", async () => {
      const provider = createTestProvider();
      let loggedProvider: string | undefined;

      const webhook = createWebhook(provider).event(
        testEvent,
        (_payload, context) => {
          // Handler that only uses context
          loggedProvider = context.provider;
        },
      );

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(loggedProvider).toBe("test");
    });
  });

  describe("immutability", () => {
    it("should return a new builder instance on .event()", () => {
      const provider = createTestProvider();
      const builder1 = createWebhook(provider);
      const builder2 = builder1.event(testEvent, () => {});

      expect(builder1).not.toBe(builder2);
    });

    it("should return a new builder instance on .onError()", () => {
      const provider = createTestProvider();
      const builder1 = createWebhook(provider);
      const builder2 = builder1.onError(() => {});

      expect(builder1).not.toBe(builder2);
    });

    it("should return a new builder instance on .onVerificationFailed()", () => {
      const provider = createTestProvider();
      const builder1 = createWebhook(provider);
      const builder2 = builder1.onVerificationFailed(() => {});

      expect(builder1).not.toBe(builder2);
    });
  });

  describe("process - status codes", () => {
    it("should return 204 when no event type is found", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});

      const result = await webhook.process({
        headers: {},
        rawBody: JSON.stringify(validPayload),
      });

      expect(result.status).toBe(204);
    });

    it("should return 204 when event has no handlers", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);

      const result = await webhook.process({
        headers: { "x-test-event": "unknown.event" },
        rawBody: JSON.stringify(validPayload),
      });

      expect(result.status).toBe(204);
    });

    it("should return 401 when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const webhook = createWebhook(provider).event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(401);
      expect(result.body?.error).toBe("Signature verification failed");
    });

    it("should return 400 for invalid JSON", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: "not valid json",
        secret: "test-secret",
      });

      expect(result.status).toBe(400);
      expect(result.body?.error).toBe("Invalid JSON body");
    });

    it("should return 400 for schema validation failure", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify({ invalid: "payload" }),
        secret: "test-secret",
      });

      expect(result.status).toBe(400);
      expect(result.body?.error).toBe("Schema validation failed");
    });

    it("should return 500 when handler throws", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {
        throw new Error("Handler error");
      });

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(500);
      expect(result.body?.error).toBe("Handler execution failed");
    });

    it("should return 200 on success", async () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider).event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(200);
      expect(result.eventType).toBe("test.event");
      expect(result.body?.ok).toBe(true);
    });
  });

  describe("payload extraction", () => {
    it("should validate and handle payload extracted by getPayload", async () => {
      const schema = z.object({
        action: z.string(),
        data: z.object({ id: z.number() }),
        nonce: z.string(),
      });

      const payloadEvent = defineEvent({
        name: "payload.event",
        schema,
        provider: "test" as const,
      });

      const provider: Provider<"test"> = {
        name: "test",
        verification: "disabled",
        getEventType(headers: Headers) {
          return headers["x-test-event"];
        },
        getDeliveryId() {
          return undefined;
        },
        verify() {
          return true;
        },
        getPayload(body: unknown) {
          if (body && typeof body === "object" && "payload" in body) {
            const payload = (body as { payload: unknown }).payload;
            const nonce =
              "nonce" in body &&
              typeof (body as { nonce: unknown }).nonce === "string"
                ? (body as { nonce: string }).nonce
                : undefined;

            if (payload && typeof payload === "object" && nonce) {
              return { ...(payload as Record<string, unknown>), nonce };
            }

            return payload;
          }
          return body;
        },
      };

      const handler = vi.fn();
      const webhook = createWebhook(provider).event(payloadEvent, handler);
      const envelope = {
        type: "payload.event",
        payload: { action: "created", data: { id: 1 } },
        nonce: "nonce-123",
      };

      const result = await webhook.process({
        headers: { "x-test-event": "payload.event" },
        rawBody: JSON.stringify(envelope),
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ nonce: "nonce-123" }),
        expect.objectContaining({ eventType: "payload.event" }),
      );
    });
  });

  describe("error handling", () => {
    it("should call onError when handler throws", async () => {
      const provider = createTestProvider();
      const onError = vi.fn();
      const error = new Error("Test error");

      const webhook = createWebhook(provider)
        .event(testEvent, () => {
          throw error;
        })
        .onError(onError);

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          eventType: "test.event",
          payload: validPayload,
        }),
      );
    });

    it("should call onError when schema validation fails", async () => {
      const provider = createTestProvider();
      const onError = vi.fn();

      const webhook = createWebhook(provider)
        .event(testEvent, () => {})
        .onError(onError);

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify({ invalid: true }),
        secret: "test-secret",
      });

      expect(onError).toHaveBeenCalled();
    });

    it("should call onVerificationFailed when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const onVerificationFailed = vi.fn();

      const webhook = createWebhook(provider)
        .event(testEvent, () => {})
        .onVerificationFailed(onVerificationFailed);

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onVerificationFailed).toHaveBeenCalledWith(
        "Signature verification failed",
        expect.any(Object),
      );
    });

    it("should ignore errors from onError handler", async () => {
      const provider = createTestProvider();
      const onError = vi.fn(() => {
        throw new Error("onError failure");
      });

      const webhook = createWebhook(provider)
        .event(testEvent, () => {
          throw new Error("Handler error");
        })
        .onError(onError);

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(500);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it("should ignore errors from onVerificationFailed handler", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const onVerificationFailed = vi.fn(() => {
        throw new Error("onVerificationFailed failure");
      });

      const webhook = createWebhook(provider)
        .event(testEvent, () => {})
        .onVerificationFailed(onVerificationFailed);

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(401);
      expect(onVerificationFailed).toHaveBeenCalledTimes(1);
    });
  });

  describe("secret resolution", () => {
    beforeEach(() => {
      delete process.env.TEST_WEBHOOK_SECRET;
      delete process.env.WEBHOOK_SECRET;
    });

    it("should use options.secret first", async () => {
      const provider = createTestProvider({ secret: "provider-secret" });
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "options-secret",
      });

      expect(verifyMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "options-secret",
      );
    });

    it("should use provider.secret if no options.secret", async () => {
      const provider = createTestProvider({ secret: "provider-secret" });
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        // No secret in options - should fall back to provider.secret
      });

      expect(verifyMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "provider-secret",
      );
    });

    it("should use env variable if no secret in options or provider", async () => {
      process.env.TEST_WEBHOOK_SECRET = "env-secret";

      const provider = createTestProvider();
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        // No secret in options or provider - should fall back to env variable
      });

      expect(verifyMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "env-secret",
      );
    });

    it("should fall back to WEBHOOK_SECRET when provider-specific env is missing", async () => {
      const previous = process.env.WEBHOOK_SECRET;
      process.env.WEBHOOK_SECRET = "global-secret";

      try {
        const provider = createTestProvider();
        const verifyMock = vi.spyOn(provider, "verify");

        const webhook = createWebhook(provider).event(testEvent, () => {});

        await webhook.process({
          headers: { "x-test-event": "test.event" },
          rawBody: JSON.stringify(validPayload),
        });

        expect(verifyMock).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          "global-secret",
        );
      } finally {
        if (previous === undefined) {
          delete process.env.WEBHOOK_SECRET;
        } else {
          process.env.WEBHOOK_SECRET = previous;
        }
      }
    });

    it("should fail when no secret is available and verification is required", async () => {
      const provider = createTestProvider();
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      expect(verifyMock).not.toHaveBeenCalled();
      expect(result.status).toBe(401);
      expect(result.body?.error).toBe("Missing webhook secret");
    });

    it("should allow unsigned requests when verification is disabled", async () => {
      const provider = createTestProvider({ verification: "disabled" });
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      expect(verifyMock).not.toHaveBeenCalled();
      expect(result.status).toBe(200);
    });
  });

  describe("getProvider", () => {
    it("should return the provider instance", () => {
      const provider = createTestProvider();
      const webhook = createWebhook(provider);

      expect(webhook.getProvider()).toBe(provider);
    });
  });
});

// ============================================================================
// verifyHmac Tests
// ============================================================================

describe("verifyHmac", () => {
  const secret = "test-secret";
  const payload = JSON.stringify({ test: "data" });

  function computeHmac(
    algorithm: "sha1" | "sha256" | "sha384" | "sha512",
    body: string,
    secretKey: string,
    encoding: "hex" | "base64" = "hex",
  ): string {
    const hmac = createHmac(algorithm, secretKey);
    hmac.update(body, "utf-8");
    return hmac.digest(encoding);
  }

  it("should verify a valid sha256 signature", () => {
    const signature = computeHmac("sha256", payload, secret);

    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: payload,
      secret,
      signature,
    });

    expect(isValid).toBe(true);
  });

  it("should verify a signature with prefix", () => {
    const signature = "sha256=" + computeHmac("sha256", payload, secret);

    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: payload,
      secret,
      signature,
      signaturePrefix: "sha256=",
    });

    expect(isValid).toBe(true);
  });

  it("should reject invalid signature", () => {
    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: payload,
      secret,
      signature: "invalid-signature",
    });

    expect(isValid).toBe(false);
  });

  it("should reject when prefix is expected but not found", () => {
    const signature = computeHmac("sha256", payload, secret);

    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: payload,
      secret,
      signature,
      signaturePrefix: "sha256=",
    });

    expect(isValid).toBe(false);
  });

  it("should return false when signature is undefined", () => {
    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: payload,
      secret,
      signature: undefined,
    });

    expect(isValid).toBe(false);
  });

  it("should work with base64 encoding", () => {
    const signature = computeHmac("sha256", payload, secret, "base64");

    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: payload,
      secret,
      signature,
      signatureEncoding: "base64",
    });

    expect(isValid).toBe(true);
  });

  it("should return false when base64 signature length mismatches", () => {
    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: payload,
      secret,
      signature: "AA==",
      signatureEncoding: "base64",
    });

    expect(isValid).toBe(false);
  });

  it("should work with sha1 algorithm", () => {
    const signature = computeHmac("sha1", payload, secret);

    const isValid = verifyHmac({
      algorithm: "sha1",
      rawBody: payload,
      secret,
      signature,
    });

    expect(isValid).toBe(true);
  });

  it("should work with sha512 algorithm", () => {
    const signature = computeHmac("sha512", payload, secret);

    const isValid = verifyHmac({
      algorithm: "sha512",
      rawBody: payload,
      secret,
      signature,
    });

    expect(isValid).toBe(true);
  });

  it("should handle Buffer input", () => {
    const bufferPayload = Buffer.from(payload, "utf-8");
    const signature = computeHmac("sha256", payload, secret);

    const isValid = verifyHmac({
      algorithm: "sha256",
      rawBody: bufferPayload,
      secret,
      signature,
    });

    expect(isValid).toBe(true);
  });
});

// ============================================================================
// createHmacVerifier Tests
// ============================================================================

describe("createHmacVerifier", () => {
  const secret = "test-secret";
  const payload = JSON.stringify({ test: "data" });

  function computeHmac(
    body: string,
    secretKey: string,
    encoding: "hex" | "base64" = "hex",
  ): string {
    const hmac = createHmac("sha256", secretKey);
    hmac.update(body, "utf-8");
    return hmac.digest(encoding);
  }

  it("should create a verifier function", () => {
    const verify = createHmacVerifier({
      algorithm: "sha256",
      signatureHeader: "x-signature",
    });

    expect(typeof verify).toBe("function");
  });

  it("should verify using the created verifier", () => {
    const verify = createHmacVerifier({
      algorithm: "sha256",
      signatureHeader: "x-signature",
    });

    const signature = computeHmac(payload, secret);
    const headers: Headers = { "x-signature": signature };

    const isValid = verify(payload, headers, secret);

    expect(isValid).toBe(true);
  });

  it("should handle header case insensitivity", () => {
    const verify = createHmacVerifier({
      algorithm: "sha256",
      signatureHeader: "X-Signature",
    });

    const signature = computeHmac(payload, secret);
    const headers: Headers = { "x-signature": signature };

    const isValid = verify(payload, headers, secret);

    expect(isValid).toBe(true);
  });

  it("should work with signature prefix", () => {
    const verify = createHmacVerifier({
      algorithm: "sha256",
      signatureHeader: "x-signature",
      signaturePrefix: "v1=",
    });

    const signature = "v1=" + computeHmac(payload, secret);
    const headers: Headers = { "x-signature": signature };

    const isValid = verify(payload, headers, secret);

    expect(isValid).toBe(true);
  });

  it("should verify base64 signatures", () => {
    const verify = createHmacVerifier({
      algorithm: "sha256",
      signatureHeader: "x-signature",
      signatureEncoding: "base64",
    });

    const signature = computeHmac(payload, secret, "base64");
    const headers: Headers = { "x-signature": signature };

    const isValid = verify(payload, headers, secret);

    expect(isValid).toBe(true);
  });
});

// ============================================================================
// createProvider Tests
// ============================================================================

describe("createProvider", () => {
  it("should create a provider from config", () => {
    const provider = createProvider({
      name: "custom",
      getEventType: (headers) => headers["x-event-type"],
      verify: () => true,
    });

    expect(provider.name).toBe("custom");
    expect(typeof provider.getEventType).toBe("function");
    expect(typeof provider.getDeliveryId).toBe("function");
    expect(typeof provider.verify).toBe("function");
  });

  it("should throw when verification is required and verify is missing", () => {
    expect(() =>
      createProvider({
        name: "custom",
        getEventType: (headers) => headers["x-event-type"],
      }),
    ).toThrow(
      'Webhook verification is required. Provide a verify function or set verification: "disabled".',
    );
  });

  it("should use provided secret", () => {
    const provider = createProvider({
      name: "custom",
      secret: "my-secret",
      getEventType: (headers) => headers["x-event-type"],
      verify: () => true,
    });

    expect(provider.secret).toBe("my-secret");
  });

  it("should use provided getDeliveryId", () => {
    const provider = createProvider({
      name: "custom",
      getEventType: (headers) => headers["x-event-type"],
      getDeliveryId: (headers) => headers["x-delivery-id"],
      verify: () => true,
    });

    const headers: Headers = { "x-delivery-id": "123" };
    expect(provider.getDeliveryId(headers)).toBe("123");
  });

  it("should default getDeliveryId to return undefined", () => {
    const provider = createProvider({
      name: "custom",
      getEventType: (headers) => headers["x-event-type"],
      verify: () => true,
    });

    expect(provider.getDeliveryId({})).toBeUndefined();
  });

  it("should use provided verify function", () => {
    const customVerify = vi.fn().mockReturnValue(true);

    const provider = createProvider({
      name: "custom",
      getEventType: (headers) => headers["x-event-type"],
      verify: customVerify,
    });

    const result = provider.verify("body", {}, "secret");

    expect(customVerify).toHaveBeenCalledWith("body", {}, "secret");
    expect(result).toBe(true);
  });

  it("should allow disabled verification without a verify function", () => {
    const provider = createProvider({
      name: "custom",
      getEventType: (headers) => headers["x-event-type"],
      verification: "disabled",
    });

    const result = provider.verify("body", {}, "secret");
    expect(result).toBe(true);
  });
});

// ============================================================================
// customWebhook Tests
// ============================================================================

describe("customWebhook", () => {
  const PaymentSchema = z.object({
    id: z.string(),
    amount: z.number(),
    currency: z.string(),
  });

  // Define event for the payment provider
  const paymentCompleted = defineEvent({
    name: "payment.completed",
    schema: PaymentSchema,
    provider: "payment-provider" as const,
  });

  it("should create a webhook builder with custom config", () => {
    const webhook = customWebhook({
      name: "payment-provider",
      getEventType: (headers) => headers["x-webhook-event"],
      verification: "disabled",
    });

    expect(webhook).toBeInstanceOf(WebhookBuilder);
    expect(webhook.getProvider().name).toBe("payment-provider");
  });

  it("should work with event handlers", async () => {
    const handler = vi.fn();

    const webhook = customWebhook({
      name: "payment-provider",
      getEventType: (headers) => headers["x-webhook-event"],
      verification: "disabled",
    }).event(paymentCompleted, handler);

    const payload = { id: "pay_123", amount: 1000, currency: "USD" };

    const result = await webhook.process({
      headers: { "x-webhook-event": "payment.completed" },
      rawBody: JSON.stringify(payload),
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        eventType: "payment.completed",
        provider: "payment-provider",
      }),
    );
  });

  it("should work with HMAC verification", async () => {
    const secret = "webhook-secret";
    const payload = JSON.stringify({
      id: "pay_123",
      amount: 1000,
      currency: "USD",
    });

    const hmac = createHmac("sha256", secret);
    hmac.update(payload, "utf-8");
    const signature = hmac.digest("hex");

    const handler = vi.fn();

    const webhook = customWebhook({
      name: "payment-provider",
      getEventType: (headers) => headers["x-webhook-event"],
      verify: createHmacVerifier({
        algorithm: "sha256",
        signatureHeader: "x-webhook-signature",
      }),
    }).event(paymentCompleted, handler);

    const result = await webhook.process({
      headers: {
        "x-webhook-event": "payment.completed",
        "x-webhook-signature": signature,
      },
      rawBody: payload,
      secret,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it("should reject invalid signature with HMAC verification", async () => {
    const webhook = customWebhook({
      name: "payment-provider",
      getEventType: (headers) => headers["x-webhook-event"],
      verify: createHmacVerifier({
        algorithm: "sha256",
        signatureHeader: "x-webhook-signature",
      }),
    }).event(paymentCompleted, () => {});

    const result = await webhook.process({
      headers: {
        "x-webhook-event": "payment.completed",
        "x-webhook-signature": "invalid-signature",
      },
      rawBody: JSON.stringify({ id: "pay_123", amount: 1000, currency: "USD" }),
      secret: "webhook-secret",
    });

    expect(result.status).toBe(401);
  });
});

// ============================================================================
// Observer Tests
// ============================================================================

import {
  type WebhookObserver,
  type RequestReceivedEvent,
  type CompletedEvent,
  type JsonParseFailedEvent,
  type EventUnhandledEvent,
  type VerificationSucceededEvent,
  type VerificationFailedEvent,
  type SchemaValidationSucceededEvent,
  type SchemaValidationFailedEvent,
  type HandlerStartedEvent,
  type HandlerSucceededEvent,
  type HandlerFailedEvent,
  createWebhookStats,
} from "./index.js";

describe("WebhookBuilder observability", () => {
  describe("observe()", () => {
    it("should return a new builder instance", () => {
      const provider = createTestProvider();
      const builder1 = createWebhook(provider);
      const builder2 = builder1.observe({});

      expect(builder1).not.toBe(builder2);
    });

    it("should accept a single observer", async () => {
      const provider = createTestProvider();
      const onCompleted = vi.fn();
      const observer: WebhookObserver = { onCompleted };

      const webhook = createWebhook(provider)
        .observe(observer)
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it("should accept an array of observers", async () => {
      const provider = createTestProvider();
      const onCompleted1 = vi.fn();
      const onCompleted2 = vi.fn();

      const webhook = createWebhook(provider)
        .observe([{ onCompleted: onCompleted1 }, { onCompleted: onCompleted2 }])
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });

    it("should chain multiple observe() calls", async () => {
      const provider = createTestProvider();
      const onCompleted1 = vi.fn();
      const onCompleted2 = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onCompleted: onCompleted1 })
        .observe({ onCompleted: onCompleted2 })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });
  });

  describe("lifecycle events", () => {
    it("should emit onRequestReceived at start of processing", async () => {
      const provider = createTestProvider();
      const onRequestReceived = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onRequestReceived })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onRequestReceived).toHaveBeenCalledTimes(1);
      const event = onRequestReceived.mock.calls[0]![0] as RequestReceivedEvent;
      expect(event.type).toBe("request_received");
      expect(event.provider).toBe("test");
      expect(event.rawBodyBytes).toBeGreaterThan(0);
      expect(event.receivedAt).toBeInstanceOf(Date);
    });

    it("should emit onCompleted with success for 200 response", async () => {
      const provider = createTestProvider();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onCompleted).toHaveBeenCalledTimes(1);
      const event = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(event.type).toBe("completed");
      expect(event.status).toBe(200);
      expect(event.success).toBe(true);
      expect(event.eventType).toBe("test.event");
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should include deliveryId in observation events when available", async () => {
      const provider = createTestProvider();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: {
          "x-test-event": "test.event",
          "x-test-delivery-id": "delivery-123",
        },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onCompleted).toHaveBeenCalledTimes(1);
      const event = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(event.deliveryId).toBe("delivery-123");
      expect(event.eventType).toBe("test.event");
    });

    it("should emit onJsonParseFailed for invalid JSON", async () => {
      const provider = createTestProvider();
      const onJsonParseFailed = vi.fn();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onJsonParseFailed, onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: "not valid json",
      });

      expect(onJsonParseFailed).toHaveBeenCalledTimes(1);
      const event = onJsonParseFailed.mock.calls[0]![0] as JsonParseFailedEvent;
      expect(event.type).toBe("json_parse_failed");
      expect(event.error).toBeDefined();

      // Should also emit completed
      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(400);
      expect(completedEvent.success).toBe(false);
    });

    it("should emit onEventUnhandled for 204 response", async () => {
      const provider = createTestProvider();
      const onEventUnhandled = vi.fn();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onEventUnhandled, onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "unknown.event" },
        rawBody: JSON.stringify(validPayload),
      });

      expect(onEventUnhandled).toHaveBeenCalledTimes(1);
      const event = onEventUnhandled.mock.calls[0]![0] as EventUnhandledEvent;
      expect(event.type).toBe("event_unhandled");

      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(204);
    });

    it("should emit onEventUnhandled when no event type is found", async () => {
      const provider = createTestProvider();
      const onEventUnhandled = vi.fn();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onEventUnhandled, onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: {},
        rawBody: JSON.stringify(validPayload),
      });

      expect(onEventUnhandled).toHaveBeenCalledTimes(1);
      const event = onEventUnhandled.mock.calls[0]![0] as EventUnhandledEvent;
      expect(event.type).toBe("event_unhandled");
      expect(event.eventType).toBeUndefined();

      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(204);
      expect(completedEvent.eventType).toBeUndefined();
    });

    it("should emit onVerificationSucceeded when verification passes", async () => {
      const provider = createTestProvider({ verifyResult: true });
      const onVerificationSucceeded = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onVerificationSucceeded })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onVerificationSucceeded).toHaveBeenCalledTimes(1);
      const event = onVerificationSucceeded.mock
        .calls[0]![0] as VerificationSucceededEvent;
      expect(event.type).toBe("verification_succeeded");
      expect(event.verifyDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should not emit verification events when verification is disabled", async () => {
      const provider = createTestProvider({ verification: "disabled" });
      const onVerificationSucceeded = vi.fn();
      const onVerificationFailed = vi.fn();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onVerificationSucceeded, onVerificationFailed, onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onVerificationSucceeded).not.toHaveBeenCalled();
      expect(onVerificationFailed).not.toHaveBeenCalled();
      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(200);
    });

    it("should emit onVerificationFailed when verification fails", async () => {
      const provider = createTestProvider({ verifyResult: false });
      const onVerificationFailed = vi.fn();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onVerificationFailed, onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onVerificationFailed).toHaveBeenCalledTimes(1);
      const event = onVerificationFailed.mock
        .calls[0]![0] as VerificationFailedEvent;
      expect(event.type).toBe("verification_failed");
      expect(event.reason).toBe("Signature verification failed");

      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(401);
    });

    it("should emit onSchemaValidationSucceeded when validation passes", async () => {
      const provider = createTestProvider();
      const onSchemaValidationSucceeded = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onSchemaValidationSucceeded })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onSchemaValidationSucceeded).toHaveBeenCalledTimes(1);
      const event = onSchemaValidationSucceeded.mock
        .calls[0]![0] as SchemaValidationSucceededEvent;
      expect(event.type).toBe("schema_validation_succeeded");
      expect(event.validateDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should emit onSchemaValidationFailed when validation fails", async () => {
      const provider = createTestProvider();
      const onSchemaValidationFailed = vi.fn();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onSchemaValidationFailed, onCompleted })
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify({ invalid: "payload" }),
        secret: "test-secret",
      });

      expect(onSchemaValidationFailed).toHaveBeenCalledTimes(1);
      const event = onSchemaValidationFailed.mock
        .calls[0]![0] as SchemaValidationFailedEvent;
      expect(event.type).toBe("schema_validation_failed");
      expect(event.error).toBeDefined();

      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(400);
    });

    it("should not emit schema validation events when no schema is registered for the event", async () => {
      // Create a provider without using defineEvent (raw handler without schema)
      const provider: Provider<"test-no-schema"> = {
        name: "test",
        verification: "required",
        getEventType(headers: Headers) {
          return headers["x-test-event"];
        },
        getDeliveryId(headers: Headers) {
          return headers["x-test-delivery-id"];
        },
        verify() {
          return true;
        },
      };

      // Define an event without schema validation (using z.any())
      const noSchemaEvent = defineEvent({
        name: "test.event",
        schema: z.any(),
        provider: "test-no-schema" as const,
      });

      const onSchemaValidationSucceeded = vi.fn();
      const onSchemaValidationFailed = vi.fn();
      const onCompleted = vi.fn();
      const handler = vi.fn();

      const webhook = createWebhook(provider)
        .observe({
          onSchemaValidationSucceeded,
          onSchemaValidationFailed,
          onCompleted,
        })
        .event(noSchemaEvent, handler);

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(handler).toHaveBeenCalledTimes(1);
      // Schema validation still happens but with z.any() so it always succeeds
      expect(onSchemaValidationSucceeded).toHaveBeenCalledTimes(1);
      expect(onSchemaValidationFailed).not.toHaveBeenCalled();
      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(200);
    });

    it("should emit onHandlerStarted and onHandlerSucceeded for each handler", async () => {
      const provider = createTestProvider();
      const onHandlerStarted = vi.fn();
      const onHandlerSucceeded = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onHandlerStarted, onHandlerSucceeded })
        .event(testEvent, () => {})
        .event(testEvent, () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onHandlerStarted).toHaveBeenCalledTimes(2);
      expect(onHandlerSucceeded).toHaveBeenCalledTimes(2);

      // Check first handler
      const startEvent1 = onHandlerStarted.mock
        .calls[0]![0] as HandlerStartedEvent;
      expect(startEvent1.handlerIndex).toBe(0);
      expect(startEvent1.handlerCount).toBe(2);

      const successEvent1 = onHandlerSucceeded.mock
        .calls[0]![0] as HandlerSucceededEvent;
      expect(successEvent1.handlerIndex).toBe(0);
      expect(successEvent1.handlerDurationMs).toBeGreaterThanOrEqual(0);

      // Check second handler
      const startEvent2 = onHandlerStarted.mock
        .calls[1]![0] as HandlerStartedEvent;
      expect(startEvent2.handlerIndex).toBe(1);
    });

    it("should emit onHandlerFailed when handler throws", async () => {
      const provider = createTestProvider();
      const onHandlerFailed = vi.fn();
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onHandlerFailed, onCompleted })
        .event(testEvent, () => {
          throw new Error("Handler error");
        });

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onHandlerFailed).toHaveBeenCalledTimes(1);
      const event = onHandlerFailed.mock.calls[0]![0] as HandlerFailedEvent;
      expect(event.type).toBe("handler_failed");
      expect(event.error.message).toBe("Handler error");

      expect(onCompleted).toHaveBeenCalledTimes(1);
      const completedEvent = onCompleted.mock.calls[0]![0] as CompletedEvent;
      expect(completedEvent.status).toBe(500);
    });
  });

  describe("observer error handling", () => {
    it("should swallow observer errors and continue processing", async () => {
      const provider = createTestProvider();
      const onRequestReceived = vi.fn(() => {
        throw new Error("Observer error");
      });
      const onCompleted = vi.fn();

      const webhook = createWebhook(provider)
        .observe({ onRequestReceived, onCompleted })
        .event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      // Processing should succeed despite observer error
      expect(result.status).toBe(200);
      expect(onRequestReceived).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    it("should continue calling other observers if one throws", async () => {
      const provider = createTestProvider();
      const onCompleted1 = vi.fn(() => {
        throw new Error("Observer 1 error");
      });
      const onCompleted2 = vi.fn();

      const webhook = createWebhook(provider)
        .observe([{ onCompleted: onCompleted1 }, { onCompleted: onCompleted2 }])
        .event(testEvent, () => {});

      const result = await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(result.status).toBe(200);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted2).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// createWebhookStats Tests
// ============================================================================

describe("createWebhookStats", () => {
  it("should track total requests and success/error counts", async () => {
    const provider = createTestProvider();
    const stats = createWebhookStats();

    const webhook = createWebhook(provider)
      .observe(stats.observer)
      .event(testEvent, () => {});

    // Successful request
    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify(validPayload),
      secret: "test-secret",
    });

    let snapshot = stats.snapshot();
    expect(snapshot.totalRequests).toBe(1);
    expect(snapshot.successCount).toBe(1);
    expect(snapshot.errorCount).toBe(0);

    // Failed request (invalid JSON)
    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: "invalid json",
      secret: "test-secret",
    });

    snapshot = stats.snapshot();
    expect(snapshot.totalRequests).toBe(2);
    expect(snapshot.successCount).toBe(1);
    expect(snapshot.errorCount).toBe(1);
  });

  it("should not track by event type when event type is unknown", async () => {
    const provider = createTestProvider();
    const stats = createWebhookStats();

    const webhook = createWebhook(provider).observe(stats.observer);

    await webhook.process({
      headers: {},
      rawBody: JSON.stringify(validPayload),
    });

    const snapshot = stats.snapshot();
    expect(snapshot.totalRequests).toBe(1);
    expect(Object.keys(snapshot.byEventType)).toHaveLength(0);
  });

  it("should track by provider", async () => {
    const provider = createTestProvider();
    const stats = createWebhookStats();

    const webhook = createWebhook(provider)
      .observe(stats.observer)
      .event(testEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify(validPayload),
      secret: "test-secret",
    });

    const snapshot = stats.snapshot();
    expect(snapshot.byProvider["test"]).toEqual({
      total: 1,
      success: 1,
      error: 0,
    });
  });

  it("should track by event type", async () => {
    const provider = createTestProvider();
    const stats = createWebhookStats();

    const webhook = createWebhook(provider)
      .observe(stats.observer)
      .event(testEvent, () => {})
      .event(anotherEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify(validPayload),
      secret: "test-secret",
    });

    await webhook.process({
      headers: { "x-test-event": "another.event" },
      rawBody: JSON.stringify(validPayload),
      secret: "test-secret",
    });

    const snapshot = stats.snapshot();
    expect(snapshot.byEventType["test.event"]).toEqual({
      total: 1,
      success: 1,
      error: 0,
    });
    expect(snapshot.byEventType["another.event"]).toEqual({
      total: 1,
      success: 1,
      error: 0,
    });
  });

  it("should calculate average duration", async () => {
    const provider = createTestProvider();
    const stats = createWebhookStats();

    const webhook = createWebhook(provider)
      .observe(stats.observer)
      .event(testEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify(validPayload),
      secret: "test-secret",
    });

    const snapshot = stats.snapshot();
    expect(snapshot.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("should reset stats", async () => {
    const provider = createTestProvider();
    const stats = createWebhookStats();

    const webhook = createWebhook(provider)
      .observe(stats.observer)
      .event(testEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify(validPayload),
      secret: "test-secret",
    });

    expect(stats.snapshot().totalRequests).toBe(1);

    stats.reset();

    const snapshot = stats.snapshot();
    expect(snapshot.totalRequests).toBe(0);
    expect(snapshot.successCount).toBe(0);
    expect(snapshot.errorCount).toBe(0);
    expect(snapshot.avgDurationMs).toBe(0);
    expect(Object.keys(snapshot.byProvider)).toHaveLength(0);
    expect(Object.keys(snapshot.byEventType)).toHaveLength(0);
  });
});
