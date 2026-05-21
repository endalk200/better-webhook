import { describe, expect, it, vi } from "vitest";
import {
  createMemoryIdempotencyStore,
  createMemoryReplayStore,
  createWebhookEndpoint,
  type ProviderDefinition,
  type WebhookEvent,
} from "../src/index.js";

type TestEvent =
  | (WebhookEvent<"thing.created", { id: string }> & { known: true })
  | (WebhookEvent<"thing.updated", { id: string }> & { known: true })
  | (WebhookEvent<"thing.unknown", { id: string }> & { known: false });

function provider(
  overrides: Partial<ProviderDefinition<TestEvent>> = {},
): ProviderDefinition<TestEvent> {
  return {
    name: "test",
    verify: () => ({ ok: true }),
    extractEvent: () => ({
      id: "evt_1",
      type: "thing.created",
      payload: { id: "thing_1" },
      envelope: {},
      known: true,
    }),
    ...overrides,
  };
}

const request = {
  method: "POST",
  url: "https://example.test/webhooks",
  headers: [{ name: "x-test", value: "yes" }],
  body: () => Promise.resolve(new TextEncoder().encode('{"id":"evt_1"}')),
};

describe("createWebhookEndpoint", () => {
  it("dispatches event-specific handlers with framework-neutral context", async () => {
    const handler = vi.fn();
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      handlers: { "thing.created": handler },
    });

    const { response, result } = await endpoint.handleWithResult(request);

    expect(response.status).toBe(200);
    expect(result.status).toBe("handled");
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ type: "thing.created" }),
        delivery: expect.objectContaining({ method: "POST" }),
      }),
    );
  });

  it("ignores verified events without a handler", async () => {
    const endpoint = createWebhookEndpoint({ provider: provider() });
    const { response, result } = await endpoint.handleWithResult(request);
    expect(response.status).toBe(200);
    expect(result.status).toBe("ignored");
  });

  it("prefers event-specific handlers over catch-all handlers", async () => {
    const specific = vi.fn();
    const catchAll = vi.fn();
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      handlers: { "thing.created": specific, "*": catchAll },
    });

    await endpoint.handle(request);

    expect(specific).toHaveBeenCalledOnce();
    expect(catchAll).not.toHaveBeenCalled();
  });

  it("dispatches catch-all handlers for known events by default", async () => {
    const catchAll = vi.fn();
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      handlers: { "*": catchAll },
    });

    const { result } = await endpoint.handleWithResult(request);

    expect(result.status).toBe("handled");
    expect(catchAll).toHaveBeenCalledOnce();
  });

  it("can scope catch-all handlers to unknown events", async () => {
    const catchAll = vi.fn();
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      catchAllHandlerScope: "unknown",
      handlers: { "*": catchAll },
    });

    const known = await endpoint.handleWithResult(request);
    expect(known.result.status).toBe("ignored");
    expect(catchAll).not.toHaveBeenCalled();

    const unknownEndpoint = createWebhookEndpoint({
      provider: provider({
        extractEvent: () => ({
          id: "evt_2",
          type: "thing.unknown",
          payload: { id: "thing_2" },
          envelope: {},
          known: false,
        }),
      }),
      catchAllHandlerScope: "unknown",
      handlers: { "*": catchAll },
    });

    const unknown = await unknownEndpoint.handleWithResult(request);
    expect(unknown.result.status).toBe("handled");
    expect(catchAll).toHaveBeenCalledOnce();
  });

  it("rejects failed verification before extracting events", async () => {
    const extractEvent = vi.fn();
    const endpoint = createWebhookEndpoint({
      provider: provider({
        verify: () => ({ ok: false, reason: "bad_signature" }),
        extractEvent,
      }),
    });

    const { response, result } = await endpoint.handleWithResult(request);

    expect(response.status).toBe(400);
    expect(result.status).toBe("rejected");
    expect(extractEvent).not.toHaveBeenCalled();
  });

  it("returns handler errors as retryable failures and ignores handler return values", async () => {
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      handlers: {
        "thing.created": () => {
          throw new Error("boom");
        },
      },
    });

    const { response, result } = await endpoint.handleWithResult(request);

    expect(response.status).toBe(500);
    expect(result.status).toBe("handler_error");
  });

  it("deduplicates completed events with a configured idempotency store", async () => {
    const store = createMemoryIdempotencyStore();
    const handler = vi.fn();
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      endpointIdentity: "stripe-main",
      idempotencyStore: store,
      handlers: { "thing.created": handler },
    });

    const first = await endpoint.handleWithResult(request);
    expect(first.result.status).toBe("handled");
    expect(first.result.idempotency).toBe("completed");
    const duplicate = await endpoint.handleWithResult(request);

    expect(duplicate.response.status).toBe(200);
    expect(duplicate.result.status).toBe("duplicate");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("reports completed idempotency for ignored events after reserving them", async () => {
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      endpointIdentity: "stripe-main",
      idempotencyStore: createMemoryIdempotencyStore(),
    });

    const { result } = await endpoint.handleWithResult(request);

    expect(result.status).toBe("ignored");
    expect(result.idempotency).toBe("completed");
  });

  it("returns 409 when overlapping deliveries race the same event key", async () => {
    const store = createMemoryIdempotencyStore();
    let releaseHandler: (() => void) | undefined;
    let markHandlerStarted: (() => void) | undefined;
    const handlerStarted = new Promise<void>((resolve) => {
      markHandlerStarted = resolve;
    });
    const handlerRelease = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    const handler = vi.fn(async () => {
      markHandlerStarted?.();
      await handlerRelease;
    });
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      endpointIdentity: "stripe-main",
      idempotencyStore: store,
      handlers: { "thing.created": handler },
    });

    const firstDelivery = endpoint.handleWithResult(request);
    await handlerStarted;
    const { response, result } = await endpoint.handleWithResult(request);

    expect(response.status).toBe(409);
    expect(result.status).toBe("in_progress");
    expect(handler).toHaveBeenCalledOnce();
    releaseHandler?.();
    await expect(firstDelivery).resolves.toMatchObject({
      result: { status: "handled" },
    });
  });

  it("releases idempotency reservations when handlers fail", async () => {
    const store = createMemoryIdempotencyStore();
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      endpointIdentity: "stripe-main",
      idempotencyStore: store,
      handlers: {
        "thing.created": () => {
          throw new Error("boom");
        },
      },
    });

    const { result } = await endpoint.handleWithResult(request);

    expect(store.size()).toBe(0);
    expect(result.idempotency).toBe("released");
  });

  it("requires endpoint identity when stores are configured", () => {
    expect(() =>
      createWebhookEndpoint({
        provider: provider(),
        idempotencyStore: createMemoryIdempotencyStore(),
      }),
    ).toThrow(/endpointIdentity/);
    expect(() =>
      createWebhookEndpoint({
        provider: provider(),
        replayStore: createMemoryReplayStore(),
      }),
    ).toThrow(/endpointIdentity/);
  });

  it("rejects configured idempotency when provider events lack stable ids", async () => {
    const endpoint = createWebhookEndpoint({
      provider: provider({
        extractEvent: () => ({
          type: "thing.created",
          payload: { id: "thing_1" },
          envelope: {},
          known: true,
        }),
      }),
      endpointIdentity: "stripe-main",
      idempotencyStore: createMemoryIdempotencyStore(),
      handlers: { "thing.created": vi.fn() },
    });

    const { response, result } = await endpoint.handleWithResult(request);

    expect(response.status).toBe(400);
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe("missing_idempotency_event_id");
  });

  it("does not remember replay keys for invalid event envelopes", async () => {
    const replayStore = createMemoryReplayStore();
    const endpoint = createWebhookEndpoint({
      provider: provider({
        verify: () => ({
          ok: true,
          signedTimestamp: new Date("2026-05-19T00:00:00.000Z"),
          replayKey: "delivery-key",
        }),
        extractEvent: () => {
          throw new Error("invalid envelope");
        },
      }),
      endpointIdentity: "stripe-main",
      replayStore,
      now: () => new Date("2026-05-19T00:02:00.000Z"),
      handlers: { "thing.created": vi.fn() },
    });

    const first = await endpoint.handleWithResult(request);
    const retry = await endpoint.handleWithResult(request);

    expect(first.result.status).toBe("unsupported");
    expect(first.result.reason).toBe("invalid_event_envelope");
    expect(retry.result.status).toBe("unsupported");
    expect(retry.result.reason).toBe("invalid_event_envelope");
    expect(replayStore.size()).toBe(0);
  });

  it("does not remember replay keys when idempotency requires a missing event id", async () => {
    const replayStore = createMemoryReplayStore();
    const endpoint = createWebhookEndpoint({
      provider: provider({
        verify: () => ({
          ok: true,
          signedTimestamp: new Date("2026-05-19T00:00:00.000Z"),
          replayKey: "delivery-key",
        }),
        extractEvent: () => ({
          type: "thing.created",
          payload: { id: "thing_1" },
          envelope: {},
          known: true,
        }),
      }),
      endpointIdentity: "stripe-main",
      idempotencyStore: createMemoryIdempotencyStore(),
      replayStore,
      now: () => new Date("2026-05-19T00:02:00.000Z"),
      handlers: { "thing.created": vi.fn() },
    });

    const first = await endpoint.handleWithResult(request);
    const retry = await endpoint.handleWithResult(request);

    expect(first.result.status).toBe("unsupported");
    expect(first.result.reason).toBe("missing_idempotency_event_id");
    expect(retry.result.status).toBe("unsupported");
    expect(retry.result.reason).toBe("missing_idempotency_event_id");
    expect(replayStore.size()).toBe(0);
  });

  it("rejects stale signed timestamps and remembered replay keys before handlers", async () => {
    const handler = vi.fn();
    const replayStore = createMemoryReplayStore();
    const endpoint = createWebhookEndpoint({
      provider: provider({
        verify: () => ({
          ok: true,
          signedTimestamp: new Date("2026-05-19T00:00:00.000Z"),
          replayKey: "delivery-key",
        }),
      }),
      endpointIdentity: "stripe-main",
      replayStore,
      now: () => new Date("2026-05-19T00:02:00.000Z"),
      handlers: { "thing.created": handler },
    });

    expect((await endpoint.handleWithResult(request)).result.status).toBe(
      "handled",
    );
    const replay = await endpoint.handleWithResult(request);

    expect(replay.response.status).toBe(400);
    expect(replay.result.reason).toBe("replayed_delivery");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("enforces timestamp tolerance even without a replay store", async () => {
    const endpoint = createWebhookEndpoint({
      provider: provider({
        verify: () => ({
          ok: true,
          signedTimestamp: new Date("2026-05-19T00:00:00.000Z"),
        }),
      }),
      now: () => new Date("2026-05-19T00:10:01.000Z"),
      handlers: { "thing.created": vi.fn() },
    });

    const { response, result } = await endpoint.handleWithResult(request);

    expect(response.status).toBe(400);
    expect(result.reason).toBe("stale_signed_timestamp");
  });

  it("reports accepted replay protection when timestamp tolerance passes without a replay store", async () => {
    const endpoint = createWebhookEndpoint({
      provider: provider({
        verify: () => ({
          ok: true,
          signedTimestamp: new Date("2026-05-19T00:00:00.000Z"),
        }),
      }),
      now: () => new Date("2026-05-19T00:02:00.000Z"),
      handlers: { "thing.created": vi.fn() },
    });

    const { result } = await endpoint.handleWithResult(request);

    expect(result.status).toBe("handled");
    expect(result.replay).toBe("accepted");
  });

  it("allows endpoint handle to be used as an unbound callback", async () => {
    const endpoint = createWebhookEndpoint({
      provider: provider(),
      handlers: { "thing.created": vi.fn() },
    });
    const handle = endpoint.handle;

    await expect(handle(request)).resolves.toMatchObject({ status: 200 });
  });
});
