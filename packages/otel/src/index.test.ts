import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWebhook,
  defineEvent,
  createInMemoryReplayStore,
  z,
} from "@better-webhook/core";
import type { Headers, Provider } from "@better-webhook/core";
import { createOpenTelemetryInstrumentation } from "./index.js";

const telemetry = vi.hoisted(() => {
  const spans: MockSpan[] = [];
  const counterCalls = new Map<
    string,
    Array<{ value: number; attributes: Record<string, unknown> | undefined }>
  >();
  const histogramCalls = new Map<
    string,
    Array<{ value: number; attributes: Record<string, unknown> | undefined }>
  >();

  class MockSpan {
    public readonly events: Array<{
      name: string;
      attributes: Record<string, unknown> | undefined;
    }> = [];
    public readonly exceptions: Error[] = [];
    public readonly attributes: Record<string, unknown> = {};
    public status: Record<string, unknown> | undefined;
    public ended = false;

    constructor(
      public readonly name: string,
      initialAttributes: Record<string, unknown> | undefined,
    ) {
      if (initialAttributes) {
        Object.assign(this.attributes, initialAttributes);
      }
    }

    addEvent(name: string, attributes?: Record<string, unknown>) {
      this.events.push({ name, attributes });
    }

    end() {
      this.ended = true;
    }

    recordException(error: Error) {
      this.exceptions.push(error);
    }

    setAttribute(key: string, value: unknown) {
      this.attributes[key] = value;
      return this;
    }

    setAttributes(attributes: Record<string, unknown>) {
      Object.assign(this.attributes, attributes);
      return this;
    }

    setStatus(status: Record<string, unknown>) {
      this.status = status;
      return this;
    }
  }

  const ensureCounter = (name: string) => {
    const existing = counterCalls.get(name);
    if (existing) {
      return existing;
    }
    const created: Array<{
      value: number;
      attributes: Record<string, unknown> | undefined;
    }> = [];
    counterCalls.set(name, created);
    return created;
  };

  const ensureHistogram = (name: string) => {
    const existing = histogramCalls.get(name);
    if (existing) {
      return existing;
    }
    const created: Array<{
      value: number;
      attributes: Record<string, unknown> | undefined;
    }> = [];
    histogramCalls.set(name, created);
    return created;
  };

  return {
    spans,
    counterCalls,
    histogramCalls,
    tracer: {
      startSpan: vi.fn(
        (name: string, options?: { attributes?: Record<string, unknown> }) => {
          const span = new MockSpan(name, options?.attributes);
          spans.push(span);
          return span;
        },
      ),
    },
    meter: {
      createCounter: vi.fn((name: string) => ({
        add(value: number, attributes?: Record<string, unknown>) {
          ensureCounter(name).push({ value, attributes });
        },
      })),
      createHistogram: vi.fn((name: string) => ({
        record(value: number, attributes?: Record<string, unknown>) {
          ensureHistogram(name).push({ value, attributes });
        },
      })),
    },
    reset() {
      spans.length = 0;
      counterCalls.clear();
      histogramCalls.clear();
    },
  };
});

vi.mock("@opentelemetry/api", () => ({
  context: {
    active: () => ({}),
  },
  metrics: {
    getMeter: () => telemetry.meter,
  },
  trace: {
    getTracer: () => telemetry.tracer,
  },
  SpanKind: {
    INTERNAL: 0,
  },
  SpanStatusCode: {
    UNSET: 0,
    OK: 1,
    ERROR: 2,
  },
}));

const testEvent = defineEvent({
  name: "test.event",
  schema: z.object({ id: z.number() }),
  provider: "test" as const,
});

function createTestProvider(options?: {
  verifyResult?: boolean;
}): Provider<"test"> {
  return {
    name: "test",
    secret: "test-secret",
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

describe("createOpenTelemetryInstrumentation", () => {
  beforeEach(() => {
    telemetry.reset();
  });

  it("creates one processing span and completion metrics", async () => {
    const webhook = createWebhook(createTestProvider())
      .instrument(createOpenTelemetryInstrumentation())
      .event(testEvent, () => {});

    await webhook.process({
      headers: {
        "x-test-event": "test.event",
        "x-test-delivery-id": "delivery-1",
      },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    });

    expect(telemetry.spans).toHaveLength(1);
    const span = telemetry.spans[0]!;
    expect(span.name).toBe("better-webhook.process");
    expect(span.ended).toBe(true);
    expect(span.attributes["better_webhook.provider"]).toBe("test");
    expect(span.attributes["better_webhook.raw_body_bytes"]).toBeGreaterThan(0);
    expect(span.attributes["http.response.status_code"]).toBe(200);
    expect(span.attributes["better_webhook.success"]).toBe(true);
    expect(span.attributes["better_webhook.event_type"]).toBeUndefined();

    expect(telemetry.counterCalls.get("better_webhook.requests")).toHaveLength(
      1,
    );
    expect(telemetry.counterCalls.get("better_webhook.completed")).toHaveLength(
      1,
    );
    expect(
      telemetry.histogramCalls.get("better_webhook.duration"),
    ).toHaveLength(1);
  });

  it("includes eventType attributes when opted in", async () => {
    const webhook = createWebhook(createTestProvider())
      .instrument(
        createOpenTelemetryInstrumentation({
          includeEventTypeAttribute: true,
        }),
      )
      .event(testEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    });

    const span = telemetry.spans[0]!;
    expect(span.attributes["better_webhook.event_type"]).toBe("test.event");
    expect(
      telemetry.counterCalls.get("better_webhook.completed")?.[0]?.attributes,
    ).toMatchObject({
      "better_webhook.event_type": "test.event",
    });
  });

  it("records unexpected handler failures as span errors and metrics", async () => {
    const webhook = createWebhook(createTestProvider())
      .instrument(createOpenTelemetryInstrumentation())
      .event(testEvent, () => {
        throw new Error("handler exploded");
      });

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    });

    const span = telemetry.spans[0]!;
    expect(span.exceptions).toHaveLength(1);
    expect(span.status).toMatchObject({ code: 2, message: "handler exploded" });
    expect(span.events.map((event) => event.name)).toContain("handler_failed");
    expect(
      telemetry.counterCalls.get("better_webhook.handler_failures"),
    ).toHaveLength(1);
  });

  it("treats verification failures as expected 4xx outcomes", async () => {
    const webhook = createWebhook(createTestProvider({ verifyResult: false }))
      .instrument(createOpenTelemetryInstrumentation())
      .event(testEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    });

    const span = telemetry.spans[0]!;
    expect(span.status).toBeUndefined();
    expect(span.events.map((event) => event.name)).toContain(
      "verification_failed",
    );
    expect(
      telemetry.counterCalls.get("better_webhook.verification_failures"),
    ).toHaveLength(1);
  });

  it("records replay duplicate metrics and optional replay key attributes", async () => {
    const webhook = createWebhook(createTestProvider())
      .withReplayProtection({ store: createInMemoryReplayStore() })
      .instrument(
        createOpenTelemetryInstrumentation({
          includeReplayKeyAttribute: true,
        }),
      )
      .event(testEvent, () => {});

    const request = {
      headers: {
        "x-test-event": "test.event",
        "x-test-delivery-id": "duplicate-id",
      },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    };

    await webhook.process(request);
    await webhook.process(request);

    const duplicateSpan = telemetry.spans[1]!;
    expect(duplicateSpan.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "replay_duplicate",
          attributes: expect.objectContaining({
            "better_webhook.replay_key": "test:duplicate-id",
          }),
        }),
      ]),
    );
    expect(
      telemetry.counterCalls.get("better_webhook.replay_duplicates"),
    ).toHaveLength(1);
  });

  it("can disable span events while still completing the span", async () => {
    const webhook = createWebhook(createTestProvider())
      .instrument(
        createOpenTelemetryInstrumentation({
          emitSpanEvents: false,
        }),
      )
      .event(testEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    });

    const span = telemetry.spans[0]!;
    expect(span.ended).toBe(true);
    expect(span.events).toHaveLength(0);
  });

  it("can disable metrics emission", async () => {
    const webhook = createWebhook(createTestProvider())
      .instrument(
        createOpenTelemetryInstrumentation({
          emitMetrics: false,
        }),
      )
      .event(testEvent, () => {});

    await webhook.process({
      headers: { "x-test-event": "test.event" },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    });

    expect(telemetry.counterCalls.size).toBe(0);
    expect(telemetry.histogramCalls.size).toBe(0);
  });

  it("includes deliveryId attributes only when opted in", async () => {
    const webhook = createWebhook(createTestProvider())
      .instrument(
        createOpenTelemetryInstrumentation({
          includeDeliveryIdAttribute: true,
        }),
      )
      .event(testEvent, () => {});

    await webhook.process({
      headers: {
        "x-test-event": "test.event",
        "x-test-delivery-id": "delivery-123",
      },
      rawBody: JSON.stringify({ id: 1 }),
      secret: "test-secret",
    });

    const span = telemetry.spans[0]!;
    expect(span.attributes["better_webhook.delivery_id"]).toBe("delivery-123");
  });
});
