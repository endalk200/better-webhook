import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ReplayEngine } from "./replay-engine.js";
import type { CapturedWebhook } from "../types/index.js";

describe("ReplayEngine", () => {
  let tempDir: string;
  let engine: ReplayEngine;

  beforeEach(() => {
    tempDir = join(tmpdir(), `better-webhook-replay-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    engine = new ReplayEngine(tempDir);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createCapture(
    overrides: Partial<CapturedWebhook> = {},
  ): CapturedWebhook {
    return {
      id: `capture-${Date.now()}`,
      timestamp: new Date().toISOString(),
      method: "POST",
      url: "http://localhost:3001/webhooks/test",
      path: "/webhooks/test",
      headers: {},
      body: {},
      rawBody: "{}",
      query: {},
      ...overrides,
    };
  }

  function saveCapture(capture: CapturedWebhook): string {
    const fileName = `${capture.timestamp.replace(/[:.]/g, "-")}-${capture.id}.json`;
    const filePath = join(tempDir, fileName);
    writeFileSync(filePath, JSON.stringify(capture, null, 2));
    return fileName;
  }

  describe("captureToTemplate with event detection", () => {
    describe("GitHub event detection", () => {
      it("should detect event from x-github-event header", () => {
        const capture = createCapture({
          provider: "github",
          headers: {
            "x-github-event": "push",
            "x-github-delivery": "abc123",
          },
          body: { ref: "refs/heads/main" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("push");
        expect(template.provider).toBe("github");
      });

      it("should handle array header value for github event", () => {
        const capture = createCapture({
          provider: "github",
          headers: {
            "x-github-event": ["pull_request", "extra"],
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("pull_request");
      });
    });

    describe("Stripe event detection", () => {
      it("should detect event from body type field", () => {
        const capture = createCapture({
          provider: "stripe",
          body: {
            id: "evt_123",
            type: "payment_intent.succeeded",
            data: { object: {} },
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("payment_intent.succeeded");
        expect(template.provider).toBe("stripe");
      });
    });

    describe("Slack event detection", () => {
      it("should detect event from body type field", () => {
        const capture = createCapture({
          provider: "slack",
          body: {
            type: "url_verification",
            challenge: "abc123",
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("url_verification");
      });

      it("should prefer body.type over nested event.type for Slack", () => {
        const capture = createCapture({
          provider: "slack",
          body: {
            type: "event_callback",
            event: {
              type: "message",
              text: "Hello",
            },
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        // Returns body.type first, not body.event.type
        expect(template.event).toBe("event_callback");
      });

      it("should fallback to nested event.type when body.type is missing", () => {
        const capture = createCapture({
          provider: "slack",
          body: {
            event: {
              type: "message",
              text: "Hello",
            },
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("message");
      });
    });

    describe("Linear event detection", () => {
      it("should detect event from body type field", () => {
        const capture = createCapture({
          provider: "linear",
          body: {
            type: "Issue",
            action: "create",
            data: {},
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("Issue");
      });
    });

    describe("Clerk event detection", () => {
      it("should detect event from body type field", () => {
        const capture = createCapture({
          provider: "clerk",
          body: {
            type: "user.created",
            data: { id: "user_123" },
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("user.created");
      });
    });

    describe("Ragie event detection", () => {
      it("should detect event from body event_type field", () => {
        const capture = createCapture({
          provider: "ragie",
          body: {
            event_type: "document_status_updated",
            payload: {},
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("document_status_updated");
      });
    });

    describe("Recall event detection", () => {
      it("should detect event from body event field", () => {
        const capture = createCapture({
          provider: "recall",
          body: {
            event: "transcript.data",
            data: {
              data: {
                words: [],
              },
            },
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("transcript.data");
      });
    });

    describe("Shopify event detection", () => {
      it("should detect event from x-shopify-topic header", () => {
        const capture = createCapture({
          provider: "shopify",
          headers: {
            "x-shopify-topic": "orders/create",
            "x-shopify-hmac-sha256": "abc123",
          },
          body: { id: 123, email: "test@example.com" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("orders/create");
        expect(template.provider).toBe("shopify");
      });

      it("should handle array header value for shopify topic", () => {
        const capture = createCapture({
          provider: "shopify",
          headers: {
            "x-shopify-topic": ["products/update", "extra"],
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("products/update");
      });
    });

    describe("SendGrid event detection", () => {
      it("should detect event from first array item event field", () => {
        const capture = createCapture({
          provider: "sendgrid",
          body: [
            { event: "delivered", email: "test@example.com" },
            { event: "open", email: "test@example.com" },
          ],
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("delivered");
      });

      it("should return undefined for empty SendGrid array", () => {
        const capture = createCapture({
          provider: "sendgrid",
          body: [],
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBeUndefined();
      });
    });

    describe("Discord event detection", () => {
      it("should detect event from body type number", () => {
        const capture = createCapture({
          provider: "discord",
          body: {
            type: 1,
            id: "123",
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("type_1");
      });
    });

    describe("custom event override", () => {
      it("should use provided event over detected event", () => {
        const capture = createCapture({
          provider: "github",
          headers: {
            "x-github-event": "push",
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id, {
          event: "custom_event",
        });

        expect(template.event).toBe("custom_event");
      });
    });

    describe("unknown provider", () => {
      it("should return undefined event when provider not recognized and no common fields", () => {
        const capture = createCapture({
          provider: "custom",
          body: { some: "data" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBeUndefined();
      });

      it("should detect event from body.type when no provider set (fallback)", () => {
        const capture = createCapture({
          body: { type: "some_event" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("some_event");
      });

      it("should return undefined event when no detectable event field", () => {
        const capture = createCapture({
          body: { data: "some_data" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBeUndefined();
      });
    });

    describe("fallback event detection for unknown providers", () => {
      it("should detect event from body.type for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: { type: "custom.event.created" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("custom.event.created");
      });

      it("should detect event from body.event_type for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: { event_type: "order_placed" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("order_placed");
      });

      it("should detect event from body.event for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: { event: "user.signup" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("user.signup");
      });

      it("should detect event from body.action for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: { action: "completed" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("completed");
      });

      it("should prioritize type > event_type > event > action for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: {
            type: "primary_type",
            event_type: "secondary_type",
            event: "tertiary_type",
            action: "quaternary_type",
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("primary_type");
      });

      it("should fallback to event_type when type is missing for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: {
            event_type: "secondary_type",
            event: "tertiary_type",
            action: "quaternary_type",
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("secondary_type");
      });

      it("should fallback to event when type and event_type are missing for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: {
            event: "tertiary_type",
            action: "quaternary_type",
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("tertiary_type");
      });

      it("should fallback to action when type, event_type, and event are missing for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: {
            action: "quaternary_type",
            data: { some: "value" },
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("quaternary_type");
      });

      it("should ignore non-string values in fallback fields for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: {
            type: 123,
            event_type: { nested: "object" },
            event: ["array"],
            action: "valid_string",
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("valid_string");
      });

      it("should return undefined when all fallback fields are non-string for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: {
            type: 123,
            event_type: null,
            event: undefined,
            action: { not: "a string" },
          },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBeUndefined();
      });

      it("should handle null body for unknown provider", () => {
        const capture = createCapture({
          provider: "custom",
          body: null as unknown as Record<string, unknown>,
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBeUndefined();
      });

      it("should use fallback for undefined provider", () => {
        const capture = createCapture({
          body: { event_type: "fallback_event" },
        });
        saveCapture(capture);

        const template = engine.captureToTemplate(capture.id);

        expect(template.event).toBe("fallback_event");
      });
    });
  });

  describe("captureToTemplate basic functionality", () => {
    it("should convert capture to template", () => {
      const capture = createCapture({
        method: "POST",
        path: "/webhooks/github",
        headers: {
          "content-type": "application/json",
          "user-agent": "GitHub-Hookshot",
        },
        body: { action: "created" },
        provider: "github",
      });
      saveCapture(capture);

      const template = engine.captureToTemplate(capture.id);

      expect(template.method).toBe("POST");
      expect(template.url).toBe("http://localhost:3000/webhooks/github");
      expect(template.body).toEqual({ action: "created" });
      expect(template.provider).toBe("github");
    });

    it("should use custom URL when provided", () => {
      const capture = createCapture({
        path: "/webhooks/test",
      });
      saveCapture(capture);

      const template = engine.captureToTemplate(capture.id, {
        url: "https://example.com/webhook",
      });

      expect(template.url).toBe("https://example.com/webhook");
    });

    it("should filter out signature headers", () => {
      const capture = createCapture({
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": "sha256=abc123",
          "stripe-signature": "t=123,v1=abc",
          "x-shopify-hmac-sha256": "abc123",
          "webhook-signature": "v1,abc123",
        },
      });
      saveCapture(capture);

      const template = engine.captureToTemplate(capture.id);

      const headerKeys = template.headers.map((h) => h.key.toLowerCase());
      expect(headerKeys).toContain("content-type");
      expect(headerKeys).not.toContain("x-hub-signature-256");
      expect(headerKeys).not.toContain("stripe-signature");
      expect(headerKeys).not.toContain("x-shopify-hmac-sha256");
      expect(headerKeys).not.toContain("webhook-signature");
    });

    it("should throw error when capture not found", () => {
      expect(() => {
        engine.captureToTemplate("non-existent-id");
      }).toThrow("Capture not found");
    });
  });
});
