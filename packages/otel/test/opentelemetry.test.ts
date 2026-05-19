import { describe, expect, it } from "vitest";
import { otel, type OtelSpan } from "../src/index.js";

describe("otel", () => {
  it("records sanitized delivery attributes without payload contents", () => {
    const spans: FakeSpan[] = [];
    const telemetry = otel({
      tracer: {
        startSpan(name, options) {
          const span = new FakeSpan(name, options?.attributes);
          spans.push(span);
          return span;
        },
      },
    });

    const context = telemetry.startDelivery?.({
      provider: "stripe",
      method: "POST",
      url: "https://example.test/stripe",
    });
    telemetry.recordError?.(
      {
        provider: "stripe",
        name: "Error",
        message: "handler failed",
      },
      context,
    );
    telemetry.finishDelivery?.(
      {
        provider: "stripe",
        status: "handler_error",
        eventType: "invoice.paid",
        eventId: "evt_123",
        verification: "accepted",
        replay: "accepted",
        idempotency: "reserved",
        handler: "failed",
        responseStatus: 500,
        error: new Error("handler failed"),
      },
      context,
    );

    expect(spans[0]?.attributes).toMatchObject({
      "webhook.provider": "stripe",
      "webhook.event.type": "invoice.paid",
      "webhook.verification": "accepted",
      "webhook.replay": "accepted",
      "webhook.idempotency": "reserved",
      "webhook.handler": "failed",
      "http.response.status_code": 500,
    });
    expect(JSON.stringify(spans[0])).not.toContain("data.object");
    expect(spans[0]?.ended).toBe(true);
  });

  it("keeps concurrent delivery spans isolated by context", () => {
    const spans: FakeSpan[] = [];
    const telemetry = otel({
      tracer: {
        startSpan(name, options) {
          const span = new FakeSpan(name, options?.attributes);
          spans.push(span);
          return span;
        },
      },
    });

    const first = telemetry.startDelivery?.({
      provider: "stripe",
      method: "POST",
      url: "https://example.test/one",
    });
    const second = telemetry.startDelivery?.({
      provider: "stripe",
      method: "POST",
      url: "https://example.test/two",
    });

    telemetry.finishDelivery?.(
      {
        provider: "stripe",
        status: "handled",
        verification: "accepted",
        replay: "accepted",
        idempotency: "not_configured",
        handler: "handled",
        responseStatus: 200,
      },
      first,
    );
    telemetry.finishDelivery?.(
      {
        provider: "stripe",
        status: "ignored",
        verification: "accepted",
        replay: "accepted",
        idempotency: "not_configured",
        handler: "ignored",
        responseStatus: 200,
      },
      second,
    );

    expect(spans[0]?.attributes["url.full"]).toBe("https://example.test/one");
    expect(spans[0]?.attributes["webhook.result"]).toBe("handled");
    expect(spans[1]?.attributes["url.full"]).toBe("https://example.test/two");
    expect(spans[1]?.attributes["webhook.result"]).toBe("ignored");
  });
});

class FakeSpan implements OtelSpan {
  public attributes: Record<string, string | number | boolean> = {};
  public ended = false;

  public constructor(
    public name: string,
    attributes: Record<string, string | number | boolean> = {},
  ) {
    this.attributes = { ...attributes };
  }

  public setAttribute(name: string, value: string | number | boolean): void {
    this.attributes[name] = value;
  }

  public addEvent(): void {}

  public recordException(): void {}

  public end(): void {
    this.ended = true;
  }
}
