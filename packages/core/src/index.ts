export type RawHeaderValue = {
  name: string;
  value: string;
};

export type RawDeliveryRequest = {
  method: string;
  url: string;
  headers: RawHeaderValue[];
  body:
    | Uint8Array
    | ArrayBuffer
    | string
    | (() => Promise<Uint8Array | ArrayBuffer | string>);
  signal?: AbortSignal;
};

export type RawHeaderCapabilities = {
  preservesRawBodyBytes: boolean;
  preservesDuplicateHeaders: boolean;
  notes?: string;
};

export type WebhookDelivery = {
  method: string;
  url: string;
  headers: RawHeaderValue[];
  rawBody: Uint8Array;
};

export type ProviderVerificationSuccess = {
  ok: true;
  signedTimestamp?: Date;
  replayKey?: string;
  signatureId?: string;
};

export type ProviderVerificationFailure = {
  ok: false;
  reason: string;
};

export type ProviderVerificationResult =
  | ProviderVerificationSuccess
  | ProviderVerificationFailure;

export type WebhookEvent<
  TType extends string = string,
  TPayload = unknown,
  TEnvelope extends Record<string, unknown> = Record<string, unknown>,
> = {
  id?: string;
  type: TType;
  payload: TPayload;
  envelope: TEnvelope;
  createdAt?: Date;
  known: boolean;
};

export type ProviderDefinition<TEvents extends WebhookEvent = WebhookEvent> = {
  name: string;
  capabilities?: {
    signedTimestamp?: boolean;
    replayKey?: boolean;
  };
  verify(
    delivery: WebhookDelivery,
  ): Promise<ProviderVerificationResult> | ProviderVerificationResult;
  extractEvent(delivery: WebhookDelivery): Promise<TEvents> | TEvents;
};

export type HandlerContext<TEvent extends WebhookEvent = WebhookEvent> = {
  event: TEvent;
  delivery: WebhookDelivery;
  signal?: AbortSignal;
};

export type EventHandler<TEvent extends WebhookEvent = WebhookEvent> = (
  context: HandlerContext<TEvent>,
) => unknown | Promise<unknown>;

export type EventHandlerMap<TEvents extends WebhookEvent> = {
  [TType in TEvents["type"]]?: EventHandler<Extract<TEvents, { type: TType }>>;
} & {
  "*"?: EventHandler<TEvents>;
};

export type IdempotencyReservation =
  | { status: "reserved"; key: string }
  | { status: "completed"; key: string }
  | { status: "in_progress"; key: string };

export type IdempotencyStore = {
  reserve(
    key: string,
    ttlMs?: number,
  ): Promise<IdempotencyReservation> | IdempotencyReservation;
  complete(key: string, ttlMs?: number): Promise<void> | void;
  fail(key: string): Promise<void> | void;
};

export type ReplayStore = {
  remember(
    key: string,
    ttlMs: number,
  ): Promise<"stored" | "seen"> | "stored" | "seen";
};

export type PipelineResultStatus =
  | "handled"
  | "ignored"
  | "duplicate"
  | "in_progress"
  | "rejected"
  | "handler_error"
  | "unsupported";

export type PipelineResult = {
  status: PipelineResultStatus;
  provider: string;
  eventType?: string;
  eventId?: string;
  verification: "accepted" | "rejected";
  replay: "accepted" | "rejected" | "not_configured";
  idempotency: "reserved" | "completed" | "in_progress" | "not_configured";
  handler: "handled" | "ignored" | "failed" | "skipped";
  reason?: string;
  error?: unknown;
};

export type WebhookResponse = {
  status: number;
  headers: RawHeaderValue[];
  body: string;
};

export type ResponsePolicy = (result: PipelineResult) => WebhookResponse;

export type TelemetryDeliveryStart = {
  provider: string;
  method: string;
  url: string;
};

export type TelemetryDeliveryEnd = PipelineResult & {
  responseStatus: number;
};

export type DeliveryTelemetryContext = unknown;

export type DeliveryTelemetry = {
  startDelivery?(
    delivery: TelemetryDeliveryStart,
  ): DeliveryTelemetryContext | void;
  finishDelivery?(
    delivery: TelemetryDeliveryEnd,
    context: DeliveryTelemetryContext | void,
  ): void;
  recordError?(
    error: {
      provider: string;
      name: string;
      message: string;
    },
    context: DeliveryTelemetryContext | void,
  ): void;
};

export type CreateWebhookEndpointOptions<TEvents extends WebhookEvent> = {
  provider: ProviderDefinition<TEvents>;
  handlers?: EventHandlerMap<TEvents>;
  endpointIdentity?: string;
  idempotencyStore?: IdempotencyStore;
  idempotencyTtlMs?: number;
  replayStore?: ReplayStore;
  replayWindowMs?: number;
  now?: () => Date;
  responsePolicy?: ResponsePolicy;
  telemetry?: DeliveryTelemetry;
};

export type WebhookEndpoint = {
  handle(request: RawDeliveryRequest): Promise<WebhookResponse>;
  handleWithResult(request: RawDeliveryRequest): Promise<{
    response: WebhookResponse;
    result: PipelineResult;
  }>;
};

const DEFAULT_REPLAY_WINDOW_MS = 5 * 60 * 1000;

export function createWebhookEndpoint<TEvents extends WebhookEvent>(
  options: CreateWebhookEndpointOptions<TEvents>,
): WebhookEndpoint {
  if (options.idempotencyStore && !options.endpointIdentity) {
    throw new Error(
      "endpointIdentity is required when idempotencyStore is configured",
    );
  }
  if (options.replayStore && !options.endpointIdentity) {
    throw new Error(
      "endpointIdentity is required when replayStore is configured",
    );
  }

  const responsePolicy = options.responsePolicy ?? defaultResponsePolicy;

  const handleWithResult: WebhookEndpoint["handleWithResult"] = async (
    request,
  ) => {
    const delivery = await toWebhookDelivery(request);
    const telemetryContext = options.telemetry?.startDelivery?.({
      provider: options.provider.name,
      method: delivery.method,
      url: delivery.url,
    });

    const finish = (result: PipelineResult) => {
      const response = responsePolicy(result);
      options.telemetry?.finishDelivery?.(
        {
          ...result,
          responseStatus: response.status,
        },
        telemetryContext,
      );
      return { response, result };
    };

    const verification = await options.provider.verify(delivery);
    if (!verification.ok) {
      return finish(
        baseResult(options.provider.name, "rejected", {
          reason: verification.reason,
          verification: "rejected",
        }),
      );
    }

    const replay = await checkReplay(options, verification);
    if (replay.status === "rejected") {
      return finish(
        baseResult(options.provider.name, "rejected", {
          reason: replay.reason,
          replay: "rejected",
        }),
      );
    }

    let event: TEvents;
    try {
      event = await options.provider.extractEvent(delivery);
    } catch (error) {
      options.telemetry?.recordError?.(
        sanitizeError(options.provider.name, error),
        telemetryContext,
      );
      return finish(
        baseResult(options.provider.name, "unsupported", {
          reason: "invalid_event_envelope",
          error,
        }),
      );
    }

    const resultBase = {
      eventType: event.type,
      eventId: event.id,
      replay: replay.status,
    } satisfies Partial<PipelineResult>;

    if (options.idempotencyStore && !event.id) {
      return finish(
        baseResult(options.provider.name, "unsupported", {
          ...resultBase,
          reason: "missing_idempotency_event_id",
        }),
      );
    }

    const reservation = await reserveEvent(options, event);
    if (reservation?.status === "completed") {
      return finish(
        baseResult(options.provider.name, "duplicate", {
          ...resultBase,
          idempotency: "completed",
          handler: "skipped",
        }),
      );
    }
    if (reservation?.status === "in_progress") {
      return finish(
        baseResult(options.provider.name, "in_progress", {
          ...resultBase,
          idempotency: "in_progress",
          handler: "skipped",
        }),
      );
    }

    const handler = getHandler(options.handlers, event);
    if (!handler) {
      if (reservation?.status === "reserved") {
        await options.idempotencyStore?.complete(
          reservation.key,
          options.idempotencyTtlMs,
        );
      }
      return finish(
        baseResult(options.provider.name, "ignored", {
          ...resultBase,
          idempotency: completedReservationStatus(reservation),
          handler: "ignored",
        }),
      );
    }

    try {
      await handler({
        event,
        delivery,
        signal: request.signal,
      } as HandlerContext<TEvents>);
      if (reservation?.status === "reserved") {
        await options.idempotencyStore?.complete(
          reservation.key,
          options.idempotencyTtlMs,
        );
      }
      return finish(
        baseResult(options.provider.name, "handled", {
          ...resultBase,
          idempotency: completedReservationStatus(reservation),
          handler: "handled",
        }),
      );
    } catch (error) {
      if (reservation?.status === "reserved") {
        await options.idempotencyStore?.fail(reservation.key);
      }
      options.telemetry?.recordError?.(
        sanitizeError(options.provider.name, error),
        telemetryContext,
      );
      return finish(
        baseResult(options.provider.name, "handler_error", {
          ...resultBase,
          idempotency: reservation?.status ?? "not_configured",
          handler: "failed",
          error,
        }),
      );
    }
  };

  return {
    async handle(request) {
      const { response } = await handleWithResult(request);
      return response;
    },
    handleWithResult,
  };
}

export async function toWebhookDelivery(
  request: RawDeliveryRequest,
): Promise<WebhookDelivery> {
  const value =
    typeof request.body === "function" ? await request.body() : request.body;
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    rawBody: toBytes(value),
  };
}

export function getHeaderValues(
  headers: RawHeaderValue[],
  name: string,
): string[] {
  const lowerName = name.toLowerCase();
  return headers
    .filter((header) => header.name.toLowerCase() === lowerName)
    .map((header) => header.value);
}

export function defaultResponsePolicy(result: PipelineResult): WebhookResponse {
  const statusByResult: Record<PipelineResultStatus, number> = {
    handled: 200,
    ignored: 200,
    duplicate: 200,
    in_progress: 409,
    rejected: 400,
    handler_error: 500,
    unsupported: 400,
  };
  return {
    status: statusByResult[result.status],
    headers: [
      { name: "content-type", value: "application/json; charset=utf-8" },
    ],
    body: JSON.stringify({
      ok:
        result.status === "handled" ||
        result.status === "ignored" ||
        result.status === "duplicate",
    }),
  };
}

export function createMemoryIdempotencyStore(): IdempotencyStore & {
  size(): number;
} {
  const entries = new Map<
    string,
    { status: "in_progress" | "completed"; expiresAt?: number }
  >();
  const prune = (key: string) => {
    const entry = entries.get(key);
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
      entries.delete(key);
    }
  };
  return {
    reserve(key, ttlMs) {
      prune(key);
      const entry = entries.get(key);
      if (entry?.status === "completed") return { status: "completed", key };
      if (entry?.status === "in_progress")
        return { status: "in_progress", key };
      entries.set(key, {
        status: "in_progress",
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      });
      return { status: "reserved", key };
    },
    complete(key, ttlMs) {
      entries.set(key, {
        status: "completed",
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      });
    },
    fail(key) {
      entries.delete(key);
    },
    size() {
      for (const key of entries.keys()) prune(key);
      return entries.size;
    },
  };
}

export function createMemoryReplayStore(): ReplayStore & { size(): number } {
  const entries = new Map<string, number>();
  const prune = (key: string) => {
    const expiresAt = entries.get(key);
    if (expiresAt && expiresAt <= Date.now()) entries.delete(key);
  };
  return {
    remember(key, ttlMs) {
      prune(key);
      if (entries.has(key)) return "seen";
      entries.set(key, Date.now() + ttlMs);
      return "stored";
    },
    size() {
      for (const key of entries.keys()) prune(key);
      return entries.size;
    },
  };
}

function toBytes(value: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

function baseResult(
  provider: string,
  status: PipelineResultStatus,
  overrides: Partial<PipelineResult> = {},
): PipelineResult {
  return {
    status,
    provider,
    verification: "accepted",
    replay: "not_configured",
    idempotency: "not_configured",
    handler: "skipped",
    ...overrides,
  };
}

async function checkReplay<TEvents extends WebhookEvent>(
  options: CreateWebhookEndpointOptions<TEvents>,
  verification: ProviderVerificationSuccess,
): Promise<{
  status: "accepted" | "not_configured" | "rejected";
  reason?: string;
}> {
  const now = options.now?.() ?? new Date();
  const windowMs = options.replayWindowMs ?? DEFAULT_REPLAY_WINDOW_MS;

  if (verification.signedTimestamp) {
    const ageMs = Math.abs(
      now.getTime() - verification.signedTimestamp.getTime(),
    );
    if (ageMs > windowMs)
      return { status: "rejected", reason: "stale_signed_timestamp" };
  }

  if (!options.replayStore || !verification.replayKey)
    return verification.signedTimestamp
      ? { status: "accepted" }
      : { status: "not_configured" };
  const key = `${options.provider.name}:${options.endpointIdentity}:${verification.replayKey}`;
  const outcome = await options.replayStore.remember(key, windowMs);
  return outcome === "seen"
    ? { status: "rejected", reason: "replayed_delivery" }
    : { status: "accepted" };
}

async function reserveEvent<TEvents extends WebhookEvent>(
  options: CreateWebhookEndpointOptions<TEvents>,
  event: TEvents,
): Promise<IdempotencyReservation | undefined> {
  if (!options.idempotencyStore) return undefined;
  const key = `${options.provider.name}:${options.endpointIdentity}:${event.id}`;
  return await options.idempotencyStore.reserve(key, options.idempotencyTtlMs);
}

function completedReservationStatus(
  reservation: IdempotencyReservation | undefined,
): PipelineResult["idempotency"] {
  if (!reservation) return "not_configured";
  return reservation.status === "reserved" ? "completed" : reservation.status;
}

function getHandler<TEvents extends WebhookEvent>(
  handlers: EventHandlerMap<TEvents> | undefined,
  event: TEvents,
): EventHandler<TEvents> | undefined {
  if (!handlers) return undefined;
  const specific = handlers[event.type as TEvents["type"]] as
    | EventHandler<TEvents>
    | undefined;
  return specific ?? (handlers["*"] as EventHandler<TEvents> | undefined);
}

function sanitizeError(
  provider: string,
  error: unknown,
): { provider: string; name: string; message: string } {
  if (error instanceof Error)
    return { provider, name: error.name, message: error.message };
  return { provider, name: "Error", message: "Unknown error" };
}
