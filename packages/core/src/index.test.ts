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
  type Provider,
  type Headers,
  type HandlerContext,
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

type TestEventMap = {
  "test.event": typeof TestEventSchema;
  "another.event": typeof TestEventSchema;
};

function createTestProvider(options?: {
  secret?: string;
  verifyResult?: boolean;
}): Provider<TestEventMap> {
  return {
    name: "test",
    schemas: {
      "test.event": TestEventSchema,
      "another.event": TestEventSchema,
    },
    secret: options?.secret,
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

      const webhook = createWebhook(provider).event("test.event", handler);

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
        })
      );
    });

    it("should support multiple handlers for the same event", async () => {
      const provider = createTestProvider();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const webhook = createWebhook(provider)
        .event("test.event", handler1)
        .event("test.event", handler2);

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(handler1).toHaveBeenCalledWith(
        validPayload,
        expect.objectContaining({ eventType: "test.event" })
      );
      expect(handler2).toHaveBeenCalledWith(
        validPayload,
        expect.objectContaining({ eventType: "test.event" })
      );
    });

    it("should execute handlers sequentially", async () => {
      const provider = createTestProvider();
      const order: number[] = [];

      const webhook = createWebhook(provider)
        .event("test.event", async () => {
          await new Promise((r) => setTimeout(r, 10));
          order.push(1);
        })
        .event("test.event", () => {
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
        "test.event",
        (_payload, context) => {
          receivedContext = context;
        }
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
        "test.event",
        (_payload, context) => {
          receivedContext = context;
        }
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
        "test.event",
        (_payload, context) => {
          receivedContext = context;
        }
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
        "test.event",
        (_payload, context) => {
          receivedContext = context;
        }
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
        "test.event",
        (_payload, context) => {
          receivedContext = context;
        }
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
        "test.event",
        (_payload, context) => {
          receivedContext = context;
        }
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
        beforeProcess.getTime()
      );
      expect(receivedContext!.receivedAt.getTime()).toBeLessThanOrEqual(
        afterProcess.getTime()
      );
    });

    it("should pass the same context to all handlers for the same event", async () => {
      const provider = createTestProvider();
      const receivedContexts: HandlerContext[] = [];

      const webhook = createWebhook(provider)
        .event("test.event", (_payload, context) => {
          receivedContexts.push(context);
        })
        .event("test.event", (_payload, context) => {
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
      expect(receivedContexts[0].headers["x-custom-header"]).toBe(
        "custom-value"
      );
    });

    it("should allow handlers to use context without payload", async () => {
      const provider = createTestProvider();
      let loggedProvider: string | undefined;

      const webhook = createWebhook(provider).event(
        "test.event",
        (_payload, context) => {
          // Handler that only uses context
          loggedProvider = context.provider;
        }
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
      const builder2 = builder1.event("test.event", () => {});

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
      const webhook = createWebhook(provider).event("test.event", () => {});

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
      const webhook = createWebhook(provider).event("test.event", () => {});

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
      const webhook = createWebhook(provider).event("test.event", () => {});

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
      const webhook = createWebhook(provider).event("test.event", () => {});

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
      const webhook = createWebhook(provider).event("test.event", () => {
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
      const webhook = createWebhook(provider).event("test.event", () => {});

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

  describe("error handling", () => {
    it("should call onError when handler throws", async () => {
      const provider = createTestProvider();
      const onError = vi.fn();
      const error = new Error("Test error");

      const webhook = createWebhook(provider)
        .event("test.event", () => {
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
        })
      );
    });

    it("should call onError when schema validation fails", async () => {
      const provider = createTestProvider();
      const onError = vi.fn();

      const webhook = createWebhook(provider)
        .event("test.event", () => {})
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
        .event("test.event", () => {})
        .onVerificationFailed(onVerificationFailed);

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "test-secret",
      });

      expect(onVerificationFailed).toHaveBeenCalledWith(
        "Signature verification failed",
        expect.any(Object)
      );
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

      const webhook = createWebhook(provider).event("test.event", () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
        secret: "options-secret",
      });

      expect(verifyMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "options-secret"
      );
    });

    it("should use provider.secret if no options.secret", async () => {
      const provider = createTestProvider({ secret: "provider-secret" });
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event("test.event", () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      expect(verifyMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "provider-secret"
      );
    });

    it("should use env variable if no secret in options or provider", async () => {
      process.env.TEST_WEBHOOK_SECRET = "env-secret";

      const provider = createTestProvider();
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event("test.event", () => {});

      await webhook.process({
        headers: { "x-test-event": "test.event" },
        rawBody: JSON.stringify(validPayload),
      });

      expect(verifyMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "env-secret"
      );
    });

    it("should skip verification if no secret available", async () => {
      const provider = createTestProvider();
      const verifyMock = vi.spyOn(provider, "verify");

      const webhook = createWebhook(provider).event("test.event", () => {});

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
    encoding: "hex" | "base64" = "hex"
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

  function computeHmac(body: string, secretKey: string): string {
    const hmac = createHmac("sha256", secretKey);
    hmac.update(body, "utf-8");
    return hmac.digest("hex");
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
});

// ============================================================================
// createProvider Tests
// ============================================================================

describe("createProvider", () => {
  const CustomEventSchema = z.object({
    type: z.string(),
    data: z.any(),
  });

  it("should create a provider from config", () => {
    const provider = createProvider({
      name: "custom",
      schemas: {
        "custom.event": CustomEventSchema,
      },
      getEventType: (headers) => headers["x-event-type"],
    });

    expect(provider.name).toBe("custom");
    expect(provider.schemas["custom.event"]).toBe(CustomEventSchema);
    expect(typeof provider.getEventType).toBe("function");
    expect(typeof provider.getDeliveryId).toBe("function");
    expect(typeof provider.verify).toBe("function");
  });

  it("should use provided secret", () => {
    const provider = createProvider({
      name: "custom",
      schemas: {},
      secret: "my-secret",
      getEventType: (headers) => headers["x-event-type"],
    });

    expect(provider.secret).toBe("my-secret");
  });

  it("should use provided getDeliveryId", () => {
    const provider = createProvider({
      name: "custom",
      schemas: {},
      getEventType: (headers) => headers["x-event-type"],
      getDeliveryId: (headers) => headers["x-delivery-id"],
    });

    const headers: Headers = { "x-delivery-id": "123" };
    expect(provider.getDeliveryId(headers)).toBe("123");
  });

  it("should default getDeliveryId to return undefined", () => {
    const provider = createProvider({
      name: "custom",
      schemas: {},
      getEventType: (headers) => headers["x-event-type"],
    });

    expect(provider.getDeliveryId({})).toBeUndefined();
  });

  it("should use provided verify function", () => {
    const customVerify = vi.fn().mockReturnValue(true);

    const provider = createProvider({
      name: "custom",
      schemas: {},
      getEventType: (headers) => headers["x-event-type"],
      verify: customVerify,
    });

    const result = provider.verify("body", {}, "secret");

    expect(customVerify).toHaveBeenCalledWith("body", {}, "secret");
    expect(result).toBe(true);
  });

  it("should default verify to return true (skip verification)", () => {
    const provider = createProvider({
      name: "custom",
      schemas: {},
      getEventType: (headers) => headers["x-event-type"],
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

  it("should create a webhook builder with custom config", () => {
    const webhook = customWebhook({
      name: "payment-provider",
      schemas: {
        "payment.completed": PaymentSchema,
      },
      getEventType: (headers) => headers["x-webhook-event"],
    });

    expect(webhook).toBeInstanceOf(WebhookBuilder);
    expect(webhook.getProvider().name).toBe("payment-provider");
  });

  it("should work with event handlers", async () => {
    const handler = vi.fn();

    const webhook = customWebhook({
      name: "payment-provider",
      schemas: {
        "payment.completed": PaymentSchema,
      },
      getEventType: (headers) => headers["x-webhook-event"],
    }).event("payment.completed", handler);

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
      })
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
      schemas: {
        "payment.completed": PaymentSchema,
      },
      getEventType: (headers) => headers["x-webhook-event"],
      verify: createHmacVerifier({
        algorithm: "sha256",
        signatureHeader: "x-webhook-signature",
      }),
    }).event("payment.completed", handler);

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
      schemas: {
        "payment.completed": PaymentSchema,
      },
      getEventType: (headers) => headers["x-webhook-event"],
      verify: createHmacVerifier({
        algorithm: "sha256",
        signatureHeader: "x-webhook-signature",
      }),
    }).event("payment.completed", () => {});

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
