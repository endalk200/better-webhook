import { createHmac, timingSafeEqual } from "node:crypto";
import { z, type ZodSchema, type ZodError } from "zod";

/**
 * Normalized headers with lowercase keys
 */
export type Headers = Record<string, string | undefined>;

/**
 * Event definition object that carries both runtime information
 * and compile-time type information for tree-shakeable imports.
 *
 * @template TName - The event name literal type (e.g., "push")
 * @template TSchema - The Zod schema type
 * @template TProvider - The provider brand (e.g., "github")
 *
 * @example
 * ```ts
 * import { push, pull_request } from "@better-webhook/github/events";
 *
 * // Each event is a separate export that can be tree-shaken
 * const webhook = github()
 *   .event(push, handler)
 *   .event(pull_request, handler);
 * ```
 */
export interface WebhookEvent<
  TName extends string = string,
  TSchema extends ZodSchema = ZodSchema,
  TProvider extends string = string,
> {
  /** Event name used for matching incoming webhooks */
  readonly name: TName;

  /** Zod schema for payload validation */
  readonly schema: TSchema;

  /**
   * Provider brand - compile-time only, used to constrain
   * which events can be registered with which provider.
   * @internal
   */
  readonly _provider?: TProvider;

  /**
   * Phantom type for payload inference.
   * @internal
   */
  readonly _output?: z.infer<TSchema>;
}

/**
 * Extract the payload type from an event definition
 */
export type InferEventPayload<E> =
  E extends WebhookEvent<string, infer S, string> ? z.infer<S> : never;

/**
 * Extract the provider brand from an event definition
 */
export type InferEventProvider<E> =
  E extends WebhookEvent<string, ZodSchema, infer P> ? P : never;

/**
 * Create a type-safe event definition for tree-shakeable imports.
 *
 * @example
 * ```ts
 * // In provider package (e.g., @better-webhook/github/events)
 * export const push = defineEvent({
 *   name: "push",
 *   schema: GitHubPushEventSchema,
 *   provider: "github" as const,
 * });
 * ```
 */
export function defineEvent<
  TName extends string,
  TSchema extends ZodSchema,
  TProvider extends string,
>(config: {
  name: TName;
  schema: TSchema;
  provider: TProvider;
}): WebhookEvent<TName, TSchema, TProvider> {
  return {
    name: config.name,
    schema: config.schema,
  } as WebhookEvent<TName, TSchema, TProvider>;
}

/**
 * Context passed to error handlers
 */
export interface ErrorContext {
  eventType: string;
  deliveryId?: string;
  payload: unknown;
}

/**
 * Context passed to event handlers
 * Provides metadata about the webhook request beyond just the payload
 */
export interface HandlerContext {
  /** The event type (e.g., "push", "pull_request", "order.created") */
  eventType: string;

  /** The provider name (e.g., "github", "stripe") */
  provider: string;

  /**
   * The delivery ID extracted from provider-specific headers
   * (e.g., X-GitHub-Delivery for GitHub)
   */
  deliveryId?: string;

  /** Normalized headers from the webhook request (lowercase keys) */
  headers: Headers;

  /** The raw request body as a string */
  rawBody: string;

  /** Timestamp when the webhook was received */
  receivedAt: Date;
}

/**
 * Optional replay metadata extracted by providers.
 */
export interface ProviderReplayContext {
  /** Stable provider-specific replay identifier */
  replayKey?: string;

  /** Unix timestamp (seconds) when available from signed metadata */
  timestamp?: number;
}

/**
 * Provider interface that webhook sources must implement.
 *
 * @template TProviderBrand - The provider brand type for type-safe event constraints
 *
 * Note: Schemas are no longer stored on the provider - they come from
 * individual event definition objects passed to .event() for tree-shaking support.
 */
export interface Provider<TProviderBrand extends string = string> {
  /** Provider name (e.g., "github", "stripe") */
  readonly name: string;

  /**
   * Provider brand for type-level constraint.
   * This is a phantom type - never exists at runtime.
   * @internal
   */
  readonly _brand?: TProviderBrand;

  /** Optional default secret (can be overridden by adapters) */
  readonly secret?: string;

  /** Verification mode (required by default) */
  readonly verification: "required" | "disabled";

  /**
   * Extract event type from headers or body
   * @param headers - Normalized headers from the webhook request
   * @param body - Optional parsed JSON body (for providers that include event type in body)
   */
  getEventType(headers: Headers, body?: unknown): string | undefined;

  /** Extract delivery ID from headers */
  getDeliveryId(headers: Headers): string | undefined;

  /** Verify signature of the payload */
  verify(rawBody: string | Buffer, headers: Headers, secret: string): boolean;

  /**
   * Optional: Extract the actual payload from the body
   * Useful for providers that wrap payloads in an envelope structure
   * (e.g., Ragie's {type, payload, nonce} format)
   * If not provided, the entire body is used as the payload
   */
  getPayload?(body: unknown): unknown;

  /**
   * Optional: Extract provider-specific replay metadata used by core replay protection.
   */
  getReplayContext?(
    headers: Headers,
    body?: unknown,
  ): ProviderReplayContext | undefined;
}

// ============================================================================
// Custom Provider Types
// ============================================================================

/**
 * Supported HMAC algorithms for signature verification
 */
export type HmacAlgorithm = "sha1" | "sha256" | "sha384" | "sha512";

/**
 * Configuration for creating a custom provider (for advanced users building their own providers)
 */
export interface ProviderConfig<TProviderBrand extends string = string> {
  /** Provider name (e.g., "my-custom-webhook") */
  name: string;

  /** Provider brand for type-level constraint */
  brand?: TProviderBrand;

  /** Optional default secret */
  secret?: string;

  /**
   * Verification mode (default: "required")
   * Use "disabled" only for trusted internal sources.
   */
  verification?: "required" | "disabled";

  /**
   * Extract event type from headers or body
   * @param headers - Normalized headers from the webhook request
   * @param body - Optional parsed JSON body (for providers that include event type in body)
   */
  getEventType: (headers: Headers, body?: unknown) => string | undefined;

  /** Extract delivery ID from headers (optional, defaults to undefined) */
  getDeliveryId?: (headers: Headers) => string | undefined;

  /**
   * Custom verification function.
   * Required when verification is "required".
   */
  verify?: (
    rawBody: string | Buffer,
    headers: Headers,
    secret: string,
  ) => boolean;

  /**
   * Optional: Extract the actual payload from the body
   * Useful for providers that wrap payloads in an envelope structure
   * (e.g., Ragie's {type, payload, nonce} format)
   * If not provided, the entire body is used as the payload
   */
  getPayload?: (body: unknown) => unknown;

  /**
   * Optional: Extract provider-specific replay metadata used by core replay protection.
   */
  getReplayContext?: (
    headers: Headers,
    body?: unknown,
  ) => ProviderReplayContext | undefined;
}

/**
 * Options for HMAC-based signature verification
 */
export interface HmacVerifyOptions {
  /** HMAC algorithm to use */
  algorithm: HmacAlgorithm;

  /** Header name containing the signature */
  signatureHeader: string;

  /**
   * Prefix in the signature value (e.g., "sha256=" for GitHub)
   * If provided, it will be stripped before comparison
   */
  signaturePrefix?: string;

  /**
   * Encoding of the signature (default: "hex")
   */
  signatureEncoding?: "hex" | "base64";
}

/**
 * Handler function for a specific event type
 *
 * @param payload - The validated and typed event payload
 * @param context - Metadata about the webhook request (event type, delivery ID, headers, etc.)
 *
 * @example
 * ```ts
 * // Simple handler - just use payload
 * .event(push, async (payload) => {
 *   console.log(payload.repository.name);
 * })
 *
 * // With context - access delivery ID, headers, etc.
 * .event(push, async (payload, context) => {
 *   console.log(`[${context.deliveryId}] Push to ${payload.repository.name}`);
 *   console.log(`Provider: ${context.provider}`);
 *   console.log(`Received at: ${context.receivedAt}`);
 * })
 * ```
 */
export type EventHandler<T> = (
  payload: T,
  context: HandlerContext,
) => Promise<void> | void;

/**
 * Error handler function
 */
export type ErrorHandler = (
  error: Error,
  context: ErrorContext,
) => Promise<void> | void;

/**
 * Verification failed handler function
 */
export type VerificationFailedHandler = (
  reason: string,
  headers: Headers,
) => Promise<void> | void;

/**
 * Result of processing a webhook
 */
export interface ProcessResult {
  status: number;
  eventType?: string;
  body?: { ok: boolean; error?: string };
}

/**
 * Options for processing a webhook
 */
export interface ProcessOptions {
  headers: Headers | Record<string, string | string[] | undefined>;
  rawBody: string | Buffer;
  secret?: string;
  maxBodyBytes?: number;
}

/**
 * Normalized context used to compute replay/idempotency keys.
 */
export interface ReplayContext {
  provider: string;
  eventType?: string;
  deliveryId?: string;
  replayKey?: string;
  timestamp?: number;
}

/**
 * Storage contract for replay protection.
 */
export type ReplayReserveResult = "reserved" | "duplicate";

/**
 * Replay store contract with atomic reservation semantics.
 */
export interface AtomicReplayStore {
  reserve(
    key: string,
    inFlightTtlSeconds: number,
  ): Promise<ReplayReserveResult> | ReplayReserveResult;
  commit(key: string, ttlSeconds: number): Promise<void> | void;
  release(key: string): Promise<void> | void;
}

/**
 * Replay store contract.
 */
export type ReplayStore = AtomicReplayStore;

/**
 * Duplicate behavior when replay key already exists.
 */
export type ReplayDuplicateBehavior = "conflict" | "ignore";

/**
 * Policy for building replay keys and determining duplicate behavior.
 */
export interface ReplayPolicy {
  /** TTL for stored replay keys */
  ttlSeconds: number;

  /** TTL for in-flight reservations before processing completes */
  inFlightTtlSeconds?: number;

  /**
   * Optional freshness tolerance (in seconds) for provider replay timestamps.
   * If configured, requests older/newer than this window are rejected.
   */
  timestampToleranceSeconds?: number;

  /** Build a canonical key from replay context */
  key(context: ReplayContext): string | undefined;

  /** Duplicate behavior (default: "conflict") */
  onDuplicate?: ReplayDuplicateBehavior;
}

/**
 * Replay protection configuration.
 */
export interface ReplayProtectionOptions {
  store: ReplayStore;
  policy?: ReplayPolicy;
}

// ============================================================================
// Observability Types
// ============================================================================

/**
 * Common fields included in all observation events
 */
export interface ObservationBase {
  /** Provider name (e.g., "github", "stripe") - always present */
  provider: string;

  /** Event type (e.g., "push", "order.created") - present when known */
  eventType?: string;

  /** Delivery ID from provider headers - present when available */
  deliveryId?: string;

  /** Size of the raw request body in bytes */
  rawBodyBytes: number;

  /** High-resolution timestamp when processing started (from performance.now()) */
  startTime: number;

  /** Timestamp when the webhook was received */
  receivedAt: Date;
}

/**
 * Emitted when a webhook request is first received
 */
export interface RequestReceivedEvent extends ObservationBase {
  type: "request_received";
}

/**
 * Emitted when JSON parsing fails
 */
export interface JsonParseFailedEvent extends ObservationBase {
  type: "json_parse_failed";
  /** Duration in milliseconds */
  durationMs: number;
  /** The parse error message */
  error: string;
}

/**
 * Emitted when no handler is registered for the event type (204 response)
 */
export interface EventUnhandledEvent extends ObservationBase {
  type: "event_unhandled";
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Emitted when the request body exceeds the configured size limit
 */
export interface BodyTooLargeEvent extends ObservationBase {
  type: "body_too_large";
  /** Configured maximum body size in bytes */
  maxBodyBytes: number;
}

/**
 * Emitted when signature verification succeeds
 */
export interface VerificationSucceededEvent extends ObservationBase {
  type: "verification_succeeded";
  /** Duration of verification in milliseconds */
  verifyDurationMs: number;
}

/**
 * Emitted when signature verification fails
 */
export interface VerificationFailedEvent extends ObservationBase {
  type: "verification_failed";
  /** Duration of verification in milliseconds */
  verifyDurationMs: number;
  /** Reason for failure */
  reason: string;
}

/**
 * Emitted when schema validation succeeds
 */
export interface SchemaValidationSucceededEvent extends ObservationBase {
  type: "schema_validation_succeeded";
  /** Duration of validation in milliseconds */
  validateDurationMs: number;
}

/**
 * Emitted when schema validation fails
 */
export interface SchemaValidationFailedEvent extends ObservationBase {
  type: "schema_validation_failed";
  /** Duration of validation in milliseconds */
  validateDurationMs: number;
  /** Validation error message */
  error: string;
}

/**
 * Emitted when a handler starts execution
 */
export interface HandlerStartedEvent extends ObservationBase {
  type: "handler_started";
  /** Zero-based index of the handler in the chain */
  handlerIndex: number;
  /** Total number of handlers registered for this event */
  handlerCount: number;
}

/**
 * Emitted when a handler completes successfully
 */
export interface HandlerSucceededEvent extends ObservationBase {
  type: "handler_succeeded";
  /** Zero-based index of the handler in the chain */
  handlerIndex: number;
  /** Total number of handlers registered for this event */
  handlerCount: number;
  /** Duration of this handler in milliseconds */
  handlerDurationMs: number;
}

/**
 * Emitted when a handler throws an error
 */
export interface HandlerFailedEvent extends ObservationBase {
  type: "handler_failed";
  /** Zero-based index of the handler in the chain */
  handlerIndex: number;
  /** Total number of handlers registered for this event */
  handlerCount: number;
  /** Duration of this handler in milliseconds */
  handlerDurationMs: number;
  /** The error that was thrown */
  error: Error;
}

/**
 * Emitted when replay protection is skipped because no replay key can be derived
 */
export interface ReplaySkippedEvent extends ObservationBase {
  type: "replay_skipped";
  reason: "missing_key";
}

/**
 * Emitted when replay freshness policy rejects a timestamp
 */
export interface ReplayFreshnessRejectedEvent extends ObservationBase {
  type: "replay_freshness_rejected";
  timestamp: number;
  toleranceSeconds: number;
}

/**
 * Emitted when replay key reservation succeeds
 */
export interface ReplayReservedEvent extends ObservationBase {
  type: "replay_reserved";
  replayKey: string;
  inFlightTtlSeconds: number;
  storeMode: "atomic";
}

/**
 * Emitted when replay protection detects a duplicate delivery
 */
export interface ReplayDuplicateEvent extends ObservationBase {
  type: "replay_duplicate";
  replayKey: string;
  behavior: ReplayDuplicateBehavior;
}

/**
 * Emitted when replay key is committed after successful processing
 */
export interface ReplayCommittedEvent extends ObservationBase {
  type: "replay_committed";
  replayKey: string;
  ttlSeconds: number;
}

/**
 * Emitted when replay key reservation is released after failed processing
 */
export interface ReplayReleasedEvent extends ObservationBase {
  type: "replay_released";
  replayKey: string;
  reason: "processing_failed";
}

/**
 * Emitted when webhook processing completes (always emitted)
 */
export interface CompletedEvent extends ObservationBase {
  type: "completed";
  /** Final HTTP status code */
  status: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Whether processing was successful (status 200) */
  success: boolean;
}

/**
 * Union of all observation event types
 */
export type ObservationEvent =
  | RequestReceivedEvent
  | JsonParseFailedEvent
  | EventUnhandledEvent
  | BodyTooLargeEvent
  | VerificationSucceededEvent
  | VerificationFailedEvent
  | SchemaValidationSucceededEvent
  | SchemaValidationFailedEvent
  | HandlerStartedEvent
  | HandlerSucceededEvent
  | HandlerFailedEvent
  | ReplaySkippedEvent
  | ReplayFreshnessRejectedEvent
  | ReplayReservedEvent
  | ReplayDuplicateEvent
  | ReplayCommittedEvent
  | ReplayReleasedEvent
  | CompletedEvent;

/**
 * Observer interface for webhook lifecycle events.
 * All methods are optional - implement only the ones you need.
 *
 * @example
 * ```ts
 * const observer: WebhookObserver = {
 *   onRequestReceived: (event) => {
 *     console.log(`Received webhook from ${event.provider}`);
 *   },
 *   onCompleted: (event) => {
 *     metrics.histogram('webhook_duration_ms', event.durationMs, {
 *       provider: event.provider,
 *       eventType: event.eventType,
 *       status: event.status,
 *     });
 *   },
 * };
 *
 * const webhook = github()
 *   .observe(observer)
 *   .event(push, handler);
 * ```
 */
export interface WebhookObserver {
  /** Called when a webhook request is first received */
  onRequestReceived?: (event: RequestReceivedEvent) => void;

  /** Called when JSON parsing fails */
  onJsonParseFailed?: (event: JsonParseFailedEvent) => void;

  /** Called when no handler is registered for the event type */
  onEventUnhandled?: (event: EventUnhandledEvent) => void;

  /** Called when request body exceeds the configured size limit */
  onBodyTooLarge?: (event: BodyTooLargeEvent) => void;

  /** Called when signature verification succeeds */
  onVerificationSucceeded?: (event: VerificationSucceededEvent) => void;

  /** Called when signature verification fails */
  onVerificationFailed?: (event: VerificationFailedEvent) => void;

  /** Called when schema validation succeeds */
  onSchemaValidationSucceeded?: (event: SchemaValidationSucceededEvent) => void;

  /** Called when schema validation fails */
  onSchemaValidationFailed?: (event: SchemaValidationFailedEvent) => void;

  /** Called when a handler starts execution */
  onHandlerStarted?: (event: HandlerStartedEvent) => void;

  /** Called when a handler completes successfully */
  onHandlerSucceeded?: (event: HandlerSucceededEvent) => void;

  /** Called when a handler throws an error */
  onHandlerFailed?: (event: HandlerFailedEvent) => void;

  /** Called when replay protection is skipped due to missing key material */
  onReplaySkipped?: (event: ReplaySkippedEvent) => void;

  /** Called when replay freshness policy rejects a stale/future timestamp */
  onReplayFreshnessRejected?: (event: ReplayFreshnessRejectedEvent) => void;

  /** Called when replay key reservation succeeds */
  onReplayReserved?: (event: ReplayReservedEvent) => void;

  /** Called when a duplicate replay key is detected */
  onReplayDuplicate?: (event: ReplayDuplicateEvent) => void;

  /** Called when replay key is committed after successful processing */
  onReplayCommitted?: (event: ReplayCommittedEvent) => void;

  /** Called when replay reservation is released after failed processing */
  onReplayReleased?: (event: ReplayReleasedEvent) => void;

  /** Called when webhook processing completes (always called) */
  onCompleted?: (event: CompletedEvent) => void;
}

/**
 * Helper to create a simple in-memory stats collector
 *
 * @example
 * ```ts
 * const stats = createWebhookStats();
 *
 * const webhook = github()
 *   .observe(stats.observer)
 *   .event(push, handler);
 *
 * // Later, get stats
 * console.log(stats.snapshot());
 * // {
 * //   totalRequests: 150,
 * //   successCount: 145,
 * //   errorCount: 5,
 * //   byProvider: { github: { total: 150, success: 145, error: 5 } },
 * //   byEventType: { push: { total: 100, success: 98, error: 2 }, ... },
 * //   avgDurationMs: 23.5,
 * // }
 * ```
 */
export function createWebhookStats(): {
  observer: WebhookObserver;
  snapshot: () => WebhookStatsSnapshot;
  reset: () => void;
} {
  let totalRequests = 0;
  let successCount = 0;
  let errorCount = 0;
  let totalDurationMs = 0;
  const byProvider: Record<
    string,
    { total: number; success: number; error: number }
  > = {};
  const byEventType: Record<
    string,
    { total: number; success: number; error: number }
  > = {};

  const observer: WebhookObserver = {
    onCompleted: (event) => {
      totalRequests++;
      totalDurationMs += event.durationMs;

      if (event.success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Track by provider
      let providerStats = byProvider[event.provider];
      if (!providerStats) {
        providerStats = { total: 0, success: 0, error: 0 };
        byProvider[event.provider] = providerStats;
      }
      providerStats.total++;
      if (event.success) {
        providerStats.success++;
      } else {
        providerStats.error++;
      }

      // Track by event type (if known)
      if (event.eventType) {
        let eventStats = byEventType[event.eventType];
        if (!eventStats) {
          eventStats = { total: 0, success: 0, error: 0 };
          byEventType[event.eventType] = eventStats;
        }
        eventStats.total++;
        if (event.success) {
          eventStats.success++;
        } else {
          eventStats.error++;
        }
      }
    },
  };

  const snapshot = (): WebhookStatsSnapshot => ({
    totalRequests,
    successCount,
    errorCount,
    byProvider: { ...byProvider },
    byEventType: { ...byEventType },
    avgDurationMs: totalRequests > 0 ? totalDurationMs / totalRequests : 0,
  });

  const reset = () => {
    totalRequests = 0;
    successCount = 0;
    errorCount = 0;
    totalDurationMs = 0;
    for (const key of Object.keys(byProvider)) {
      delete byProvider[key];
    }
    for (const key of Object.keys(byEventType)) {
      delete byEventType[key];
    }
  };

  return { observer, snapshot, reset };
}

const DEFAULT_REPLAY_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_REPLAY_IN_FLIGHT_TTL_SECONDS = 60;
const DEFAULT_REPLAY_SWEEP_INTERVAL_MS = 60_000;
const DEFAULT_REPLAY_SWEEP_BATCH_SIZE = 128;
const DUPLICATE_WEBHOOK_ERROR = "Duplicate webhook delivery";
const REPLAY_TIMESTAMP_OUTSIDE_TOLERANCE_ERROR =
  "Webhook timestamp outside replay tolerance";
const REPLAY_PROTECTION_FAILED_ERROR = "Replay protection failed";

interface ResolvedReplayPolicy {
  ttlSeconds: number;
  inFlightTtlSeconds: number;
  timestampToleranceSeconds?: number;
  key: (context: ReplayContext) => string | undefined;
  onDuplicate: ReplayDuplicateBehavior;
}

export interface InMemoryReplayStoreOptions {
  /**
   * Max number of entries retained in memory.
   * When exceeded, the store evicts soonest-to-expire entries.
   */
  maxEntries?: number;

  /**
   * Minimum interval between opportunistic cleanup sweeps.
   * Defaults to 60 seconds.
   */
  cleanupIntervalMs?: number;

  /**
   * Max number of expired entries removed per cleanup sweep.
   * Defaults to 128.
   */
  cleanupBatchSize?: number;
}

function createDefaultReplayPolicy(): ReplayPolicy {
  return {
    ttlSeconds: DEFAULT_REPLAY_TTL_SECONDS,
    inFlightTtlSeconds: DEFAULT_REPLAY_IN_FLIGHT_TTL_SECONDS,
    key: (context: ReplayContext): string | undefined => {
      const candidate = context.replayKey ?? context.deliveryId;
      if (!candidate) {
        return undefined;
      }
      return `${context.provider}:${candidate}`;
    },
    onDuplicate: "conflict",
  };
}

/**
 * In-memory replay store implementation.
 * Useful for local development and single-instance deployments.
 */
class InMemoryReplayStore implements AtomicReplayStore {
  private readonly entries = new Map<string, number>();
  private readonly maxEntries?: number;
  private readonly cleanupIntervalMs: number;
  private readonly cleanupBatchSize: number;
  private lastCleanupAt = 0;

  constructor(options?: InMemoryReplayStoreOptions) {
    if (
      options?.maxEntries !== undefined &&
      (!Number.isInteger(options.maxEntries) || options.maxEntries <= 0)
    ) {
      throw new RangeError("maxEntries must be a positive integer");
    }
    if (
      options?.cleanupIntervalMs !== undefined &&
      (!Number.isInteger(options.cleanupIntervalMs) ||
        options.cleanupIntervalMs <= 0)
    ) {
      throw new RangeError("cleanupIntervalMs must be a positive integer");
    }
    if (
      options?.cleanupBatchSize !== undefined &&
      (!Number.isInteger(options.cleanupBatchSize) ||
        options.cleanupBatchSize <= 0)
    ) {
      throw new RangeError("cleanupBatchSize must be a positive integer");
    }
    this.maxEntries = options?.maxEntries;
    this.cleanupIntervalMs =
      options?.cleanupIntervalMs ?? DEFAULT_REPLAY_SWEEP_INTERVAL_MS;
    this.cleanupBatchSize =
      options?.cleanupBatchSize ?? DEFAULT_REPLAY_SWEEP_BATCH_SIZE;
  }

  reserve(key: string, inFlightTtlSeconds: number): ReplayReserveResult {
    this.assertPositiveInteger(
      inFlightTtlSeconds,
      "Replay store inFlightTtlSeconds must be a positive integer",
    );
    this.cleanupExpiredEntries(false);
    const expiresAt = this.entries.get(key);
    if (expiresAt === undefined) {
      this.entries.set(key, Date.now() + inFlightTtlSeconds * 1000);
      this.enforceMaxEntries();
      return "reserved";
    }
    if (expiresAt <= Date.now()) {
      this.entries.set(key, Date.now() + inFlightTtlSeconds * 1000);
      this.enforceMaxEntries();
      return "reserved";
    }
    return "duplicate";
  }

  commit(key: string, ttlSeconds: number): void {
    this.assertPositiveInteger(
      ttlSeconds,
      "Replay store ttlSeconds must be a positive integer",
    );
    this.cleanupExpiredEntries(false);
    this.entries.set(key, Date.now() + ttlSeconds * 1000);
    this.enforceMaxEntries();
  }

  release(key: string): void {
    this.entries.delete(key);
  }

  private assertPositiveInteger(value: number, message: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new RangeError(message);
    }
  }

  private cleanupExpiredEntries(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastCleanupAt < this.cleanupIntervalMs) {
      return;
    }
    let removed = 0;
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) {
        this.entries.delete(key);
        removed++;
      }
      if (removed >= this.cleanupBatchSize) {
        break;
      }
    }
    this.lastCleanupAt = now;
  }

  private enforceMaxEntries(): void {
    if (this.maxEntries === undefined || this.entries.size <= this.maxEntries) {
      return;
    }
    this.cleanupExpiredEntries(true);
    if (this.entries.size <= this.maxEntries) {
      return;
    }

    const sortedByExpiry = [...this.entries.entries()].sort((left, right) => {
      return left[1] - right[1];
    });
    const entriesToRemove = this.entries.size - this.maxEntries;
    for (let index = 0; index < entriesToRemove; index++) {
      const candidate = sortedByExpiry[index];
      if (candidate) {
        this.entries.delete(candidate[0]);
      }
    }
  }
}

/**
 * Create an in-memory replay store for replay/idempotency protection.
 */
export function createInMemoryReplayStore(
  options?: InMemoryReplayStoreOptions,
): ReplayStore {
  return new InMemoryReplayStore(options);
}

/**
 * Snapshot of webhook statistics
 */
export interface WebhookStatsSnapshot {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  byProvider: Record<string, { total: number; success: number; error: number }>;
  byEventType: Record<
    string,
    { total: number; success: number; error: number }
  >;
  avgDurationMs: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize headers to lowercase keys with string values
 */
export function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Headers {
  const normalized: Headers = {};
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (Array.isArray(value)) {
      normalized[normalizedKey] = value[0];
    } else {
      normalized[normalizedKey] = value;
    }
  }
  return normalized;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================================
// Custom Provider Helpers
// ============================================================================

/**
 * Verify an HMAC signature
 *
 * @example
 * ```ts
 * // Verify a GitHub-style signature
 * const isValid = verifyHmac({
 *   algorithm: 'sha256',
 *   rawBody: body,
 *   secret: 'my-secret',
 *   signature: headers['x-hub-signature-256'],
 *   signaturePrefix: 'sha256=',
 * });
 * ```
 */
export function verifyHmac(options: {
  algorithm: HmacAlgorithm;
  rawBody: string | Buffer;
  secret: string;
  signature: string | undefined;
  signaturePrefix?: string;
  signatureEncoding?: "hex" | "base64";
}): boolean {
  const {
    algorithm,
    rawBody,
    secret,
    signature,
    signaturePrefix,
    signatureEncoding = "hex",
  } = options;

  if (!signature) {
    return false;
  }

  // Strip prefix if provided
  let expectedSignature = signature;
  if (signaturePrefix && signature.startsWith(signaturePrefix)) {
    expectedSignature = signature.slice(signaturePrefix.length);
  } else if (signaturePrefix) {
    // Prefix was expected but not found
    return false;
  }

  // Compute HMAC
  const body =
    typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
  const hmac = createHmac(algorithm, secret);
  hmac.update(body, "utf-8");
  const computedSignature = hmac.digest(signatureEncoding);

  // Constant-time comparison
  try {
    const expectedBuffer = Buffer.from(expectedSignature, signatureEncoding);
    const computedBuffer = Buffer.from(computedSignature, signatureEncoding);

    if (expectedBuffer.length !== computedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, computedBuffer);
  } catch {
    return false;
  }
}

/**
 * Create a verification function using HMAC
 *
 * @example
 * ```ts
 * const verify = createHmacVerifier({
 *   algorithm: 'sha256',
 *   signatureHeader: 'x-signature',
 *   signaturePrefix: 'sha256=',
 * });
 *
 * const isValid = verify(rawBody, headers, secret);
 * ```
 */
export function createHmacVerifier(
  options: HmacVerifyOptions,
): (rawBody: string | Buffer, headers: Headers, secret: string) => boolean {
  const {
    algorithm,
    signatureHeader,
    signaturePrefix,
    signatureEncoding = "hex",
  } = options;

  return (
    rawBody: string | Buffer,
    headers: Headers,
    secret: string,
  ): boolean => {
    const signature = headers[signatureHeader.toLowerCase()];

    return verifyHmac({
      algorithm,
      rawBody,
      secret,
      signature,
      signaturePrefix,
      signatureEncoding,
    });
  };
}

/**
 * Create a custom webhook provider
 *
 * @example
 * ```ts
 * import { createProvider, createHmacVerifier, z, defineEvent } from '@better-webhook/core';
 *
 * const OrderEventSchema = z.object({
 *   orderId: z.string(),
 *   status: z.enum(['pending', 'completed', 'cancelled']),
 *   amount: z.number(),
 * });
 *
 * // Define events separately for tree-shaking
 * const orderCreated = defineEvent({
 *   name: 'order.created',
 *   schema: OrderEventSchema,
 *   provider: 'my-ecommerce' as const,
 * });
 *
 * const myProvider = createProvider({
 *   name: 'my-ecommerce',
 *   getEventType: (headers) => headers['x-event-type'],
 *   getDeliveryId: (headers) => headers['x-delivery-id'],
 *   verify: createHmacVerifier({
 *     algorithm: 'sha256',
 *     signatureHeader: 'x-signature',
 *   }),
 * });
 *
 * // Use with createWebhook
 * const webhook = createWebhook(myProvider)
 *   .event(orderCreated, async (payload) => {
 *     console.log('New order:', payload.orderId);
 *   });
 * ```
 */
export function createProvider<TProviderBrand extends string = string>(
  config: ProviderConfig<TProviderBrand>,
): Provider<TProviderBrand> {
  const {
    name,
    secret,
    getEventType,
    getDeliveryId = () => undefined,
    verify,
    getPayload,
    getReplayContext,
    verification = "required",
  } = config;

  if (verification === "required" && !verify) {
    throw new Error(
      'Webhook verification is required. Provide a verify function or set verification: "disabled".',
    );
  }

  return {
    name,
    secret,
    getEventType,
    getDeliveryId,
    verify: verify ?? (() => true),
    getPayload,
    getReplayContext,
    verification,
  };
}

/**
 * Create a custom webhook builder with inline configuration
 *
 * This is a convenience function that combines createProvider and createWebhook
 *
 * @example
 * ```ts
 * import { customWebhook, createHmacVerifier, z, defineEvent } from '@better-webhook/core';
 *
 * const PaymentEventSchema = z.object({
 *   paymentId: z.string(),
 *   amount: z.number(),
 *   currency: z.string(),
 * });
 *
 * // Define events separately for tree-shaking
 * const paymentCompleted = defineEvent({
 *   name: 'payment.completed',
 *   schema: PaymentEventSchema,
 *   provider: 'payment-provider' as const,
 * });
 *
 * const webhook = customWebhook({
 *   name: 'payment-provider',
 *   getEventType: (headers) => headers['x-webhook-event'],
 *   verify: createHmacVerifier({
 *     algorithm: 'sha256',
 *     signatureHeader: 'x-webhook-signature',
 *     signaturePrefix: 'v1=',
 *   }),
 * })
 *   .event(paymentCompleted, async (payload) => {
 *     console.log('Payment received:', payload.paymentId);
 *   });
 * ```
 */
export function customWebhook<TProviderBrand extends string = string>(
  config: ProviderConfig<TProviderBrand>,
): WebhookBuilder<TProviderBrand> {
  const provider = createProvider(config);
  return new WebhookBuilder(provider);
}

// ============================================================================
// WebhookBuilder Class
// ============================================================================

/**
 * Internal storage for registered handlers including their schemas
 */
interface HandlerEntry {
  schema: ZodSchema;
  handlers: ((
    payload: unknown,
    context: HandlerContext,
  ) => Promise<void> | void)[];
}

/**
 * Fluent webhook builder with type-safe event handling.
 *
 * @template TProviderBrand - The provider brand type for constraining events
 *
 * @example
 * ```ts
 * import { github } from "@better-webhook/github";
 * import { push, pull_request } from "@better-webhook/github/events";
 *
 * const webhook = github()
 *   .event(push, async (payload) => {
 *     // payload is fully typed as GitHubPushEvent
 *     console.log(payload.repository.full_name);
 *   })
 *   .event(pull_request, async (payload) => {
 *     console.log(`PR #${payload.number}: ${payload.pull_request.title}`);
 *   });
 * ```
 */
export class WebhookBuilder<TProviderBrand extends string = string> {
  private readonly provider: Provider<TProviderBrand>;
  private readonly handlerEntries: Map<string, HandlerEntry> = new Map();
  private errorHandler?: ErrorHandler;
  private verificationFailedHandler?: VerificationFailedHandler;
  private maxBodyBytesLimit?: number;
  private readonly observers: WebhookObserver[] = [];
  private replayProtection?: {
    store: ReplayStore;
    policy: ResolvedReplayPolicy;
  };

  constructor(provider: Provider<TProviderBrand>) {
    this.provider = provider;
  }

  /**
   * Register an observer for webhook lifecycle events
   * Returns a new builder instance for immutable chaining
   *
   * @param observer - The observer to register (or array of observers)
   *
   * @example
   * ```ts
   * const stats = createWebhookStats();
   *
   * const webhook = github()
   *   .observe(stats.observer)
   *   .event(push, handler);
   *
   * // Custom observer
   * const webhook = github()
   *   .observe({
   *     onCompleted: (event) => {
   *       metrics.histogram('webhook_duration_ms', event.durationMs, {
   *         provider: event.provider,
   *         eventType: event.eventType,
   *       });
   *     },
   *   })
   *   .event(push, handler);
   * ```
   */
  observe(
    observer: WebhookObserver | WebhookObserver[],
  ): WebhookBuilder<TProviderBrand> {
    const newBuilder = this.clone();
    const observersToAdd = Array.isArray(observer) ? observer : [observer];
    newBuilder.observers.push(...observersToAdd);
    return newBuilder;
  }

  /**
   * Register a handler for a specific event.
   *
   * The event object provides:
   * - Runtime: name for matching, schema for validation
   * - Compile-time: provider constraint, payload type inference
   *
   * @param event - Event definition object (e.g., `push`, `pull_request`)
   * @param handler - Handler function with typed payload
   *
   * @example
   * ```ts
   * import { github } from "@better-webhook/github";
   * import { push, pull_request } from "@better-webhook/github/events";
   *
   * const webhook = github()
   *   .event(push, async (payload) => {
   *     // payload is typed as GitHubPushEvent
   *     console.log(payload.repository.full_name);
   *   })
   *   .event(pull_request, async (payload, ctx) => {
   *     // payload is typed as GitHubPullRequestEvent
   *     console.log(`PR #${payload.number}: ${payload.pull_request.title}`);
   *   });
   * ```
   */
  event<E extends WebhookEvent<string, ZodSchema, TProviderBrand>>(
    event: E,
    handler: EventHandler<InferEventPayload<E>>,
  ): WebhookBuilder<TProviderBrand> {
    const newBuilder = this.clone();

    const eventName = event.name;
    let entry = newBuilder.handlerEntries.get(eventName);

    if (!entry) {
      entry = {
        schema: event.schema,
        handlers: [],
      };
      newBuilder.handlerEntries.set(eventName, entry);
    }

    entry.handlers.push(
      handler as (
        payload: unknown,
        context: HandlerContext,
      ) => Promise<void> | void,
    );

    return newBuilder;
  }

  /**
   * Register an error handler
   * Returns a new builder instance for immutable chaining
   */
  onError(handler: ErrorHandler): WebhookBuilder<TProviderBrand> {
    const newBuilder = this.clone();
    newBuilder.errorHandler = handler;
    return newBuilder;
  }

  /**
   * Register a verification failed handler
   * Returns a new builder instance for immutable chaining
   */
  onVerificationFailed(
    handler: VerificationFailedHandler,
  ): WebhookBuilder<TProviderBrand> {
    const newBuilder = this.clone();
    newBuilder.verificationFailedHandler = handler;
    return newBuilder;
  }

  /**
   * Set a maximum request body size in bytes.
   * Requests larger than this limit return a 413 response.
   *
   * Note: This guard runs after adapters/frameworks read the request body.
   * Keep proxy/framework request size limits configured as the first line of
   * defense against memory exhaustion.
   *
   * @param bytes - Maximum body size in bytes
   * @returns A new builder instance with the configured limit
   */
  maxBodyBytes(bytes: number): WebhookBuilder<TProviderBrand> {
    if (!Number.isInteger(bytes) || bytes <= 0) {
      throw new RangeError("maxBodyBytes must be a positive integer");
    }

    const newBuilder = this.clone();
    newBuilder.maxBodyBytesLimit = bytes;
    return newBuilder;
  }

  /**
   * Enable replay/idempotency protection using a pluggable store and policy.
   */
  withReplayProtection(
    options: ReplayProtectionOptions,
  ): WebhookBuilder<TProviderBrand> {
    const { store, policy } = options;
    const resolvedPolicy = policy ?? createDefaultReplayPolicy();
    const duplicateBehavior = resolvedPolicy.onDuplicate ?? "conflict";
    const inFlightTtlSeconds =
      resolvedPolicy.inFlightTtlSeconds ??
      Math.min(resolvedPolicy.ttlSeconds, DEFAULT_REPLAY_IN_FLIGHT_TTL_SECONDS);

    if (
      !Number.isInteger(resolvedPolicy.ttlSeconds) ||
      resolvedPolicy.ttlSeconds <= 0
    ) {
      throw new RangeError(
        "replay policy ttlSeconds must be a positive integer",
      );
    }
    if (!Number.isInteger(inFlightTtlSeconds) || inFlightTtlSeconds <= 0) {
      throw new RangeError(
        "replay policy inFlightTtlSeconds must be a positive integer",
      );
    }
    if (
      resolvedPolicy.timestampToleranceSeconds !== undefined &&
      (!Number.isInteger(resolvedPolicy.timestampToleranceSeconds) ||
        resolvedPolicy.timestampToleranceSeconds <= 0)
    ) {
      throw new RangeError(
        "replay policy timestampToleranceSeconds must be a positive integer",
      );
    }
    if (duplicateBehavior !== "conflict" && duplicateBehavior !== "ignore") {
      throw new RangeError(
        'replay policy onDuplicate must be either "conflict" or "ignore"',
      );
    }

    const newBuilder = this.clone();
    newBuilder.replayProtection = {
      store,
      policy: {
        ttlSeconds: resolvedPolicy.ttlSeconds,
        inFlightTtlSeconds,
        timestampToleranceSeconds: resolvedPolicy.timestampToleranceSeconds,
        key: resolvedPolicy.key,
        onDuplicate: duplicateBehavior,
      },
    };
    return newBuilder;
  }

  /**
   * Process an incoming webhook request
   * Used by adapters to handle the webhook lifecycle
   */
  async process(options: ProcessOptions): Promise<ProcessResult> {
    const { rawBody, secret, maxBodyBytes } = options;
    const startTime = performance.now();
    const receivedAt = new Date();

    // Normalize headers to lowercase
    const headers = normalizeHeaders(options.headers);

    const rawBodyBytes =
      typeof rawBody === "string"
        ? Buffer.byteLength(rawBody, "utf-8")
        : rawBody.byteLength;

    // Helper to create base observation fields
    const createBase = (
      eventType?: string,
      deliveryId?: string,
    ): ObservationBase => ({
      provider: this.provider.name,
      eventType,
      deliveryId,
      rawBodyBytes,
      startTime,
      receivedAt,
    });

    let parsedBody: unknown;
    let reservedReplayKey: string | undefined;
    let replayStoreForRequest: ReplayStore | undefined;
    let replayPolicyForRequest: ResolvedReplayPolicy | undefined;

    // Helper to emit completed event and return result
    const complete = (
      status: number,
      eventType?: string,
      deliveryId?: string,
      body?: { ok: boolean; error?: string },
    ): ProcessResult => {
      const durationMs = performance.now() - startTime;
      this.emit("onCompleted", {
        ...createBase(eventType, deliveryId),
        type: "completed",
        status,
        durationMs,
        success: status === 200,
      });
      return { status, eventType, body };
    };

    const failReplayProtection = async (
      error: unknown,
      eventType?: string,
      deliveryId?: string,
    ): Promise<ProcessResult> => {
      const replayError =
        error instanceof Error
          ? error
          : new Error(REPLAY_PROTECTION_FAILED_ERROR);
      if (this.errorHandler) {
        try {
          await this.errorHandler(replayError, {
            eventType: eventType ?? "unknown",
            deliveryId,
            payload: parsedBody,
          });
        } catch {
          // Ignore errors from error handler
        }
      }
      return complete(500, eventType, deliveryId, {
        ok: false,
        error: REPLAY_PROTECTION_FAILED_ERROR,
      });
    };

    const finalizeReplay = async (
      status: number,
      eventType?: string,
      deliveryId?: string,
    ): Promise<ProcessResult | undefined> => {
      if (
        !reservedReplayKey ||
        !replayStoreForRequest ||
        !replayPolicyForRequest
      ) {
        return undefined;
      }

      const replayKey = reservedReplayKey;
      const replayStore = replayStoreForRequest;
      const replayPolicy = replayPolicyForRequest;
      reservedReplayKey = undefined;

      try {
        if (status === 200 || status === 204) {
          await replayStore.commit(replayKey, replayPolicy.ttlSeconds);
          this.emit("onReplayCommitted", {
            ...createBase(eventType, deliveryId),
            type: "replay_committed",
            replayKey,
            ttlSeconds: replayPolicy.ttlSeconds,
          });
        } else {
          await replayStore.release(replayKey);
          this.emit("onReplayReleased", {
            ...createBase(eventType, deliveryId),
            type: "replay_released",
            replayKey,
            reason: "processing_failed",
          });
        }
        return undefined;
      } catch (error) {
        return failReplayProtection(error, eventType, deliveryId);
      }
    };

    const completeWithReplay = async (
      status: number,
      eventType?: string,
      deliveryId?: string,
      body?: { ok: boolean; error?: string },
    ): Promise<ProcessResult> => {
      const replayFailure = await finalizeReplay(status, eventType, deliveryId);
      if (replayFailure) {
        return replayFailure;
      }
      return complete(status, eventType, deliveryId, body);
    };

    // Emit request received
    this.emit("onRequestReceived", {
      ...createBase(),
      type: "request_received",
    });

    const effectiveMaxBodyBytes = maxBodyBytes ?? this.maxBodyBytesLimit;
    const deliveryId = this.provider.getDeliveryId(headers);
    if (
      effectiveMaxBodyBytes !== undefined &&
      (!Number.isInteger(effectiveMaxBodyBytes) || effectiveMaxBodyBytes <= 0)
    ) {
      throw new RangeError("maxBodyBytes must be a positive integer");
    }
    if (
      effectiveMaxBodyBytes !== undefined &&
      rawBodyBytes > effectiveMaxBodyBytes
    ) {
      this.emit("onBodyTooLarge", {
        ...createBase(undefined, deliveryId),
        type: "body_too_large",
        maxBodyBytes: effectiveMaxBodyBytes,
      });
      return complete(413, undefined, deliveryId, {
        ok: false,
        error: "Payload too large",
      });
    }

    // Convert raw body to string for consistent downstream handling
    const bodyString =
      typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

    // Parse JSON body early (needed for getEventType and getPayload)
    const parseStartTime = performance.now();
    try {
      parsedBody = JSON.parse(bodyString);
    } catch (e) {
      const durationMs = performance.now() - parseStartTime;
      const error = e instanceof Error ? e.message : "Invalid JSON";
      this.emit("onJsonParseFailed", {
        ...createBase(),
        type: "json_parse_failed",
        durationMs,
        error,
      });
      return complete(400, undefined, undefined, {
        ok: false,
        error: "Invalid JSON body",
      });
    }

    // Get event type (pass parsed body for providers that extract type from body)
    const eventType = this.provider.getEventType(headers, parsedBody);

    // Resolve secret: options.secret → provider.secret → env vars
    const resolvedSecret =
      secret || this.provider.secret || this.getEnvSecret(this.provider.name);

    // Enforce verification unless explicitly disabled
    if (this.provider.verification !== "disabled") {
      if (!resolvedSecret) {
        const reason = "Missing webhook secret";

        this.emit("onVerificationFailed", {
          ...createBase(eventType, deliveryId),
          type: "verification_failed",
          verifyDurationMs: 0,
          reason,
        });

        if (this.verificationFailedHandler) {
          try {
            await this.verificationFailedHandler(reason, headers);
          } catch {
            // Ignore errors from verification failed handler
          }
        }

        return complete(401, eventType, deliveryId, {
          ok: false,
          error: reason,
        });
      }

      const verifyStartTime = performance.now();
      const isValid = this.provider.verify(rawBody, headers, resolvedSecret);
      const verifyDurationMs = performance.now() - verifyStartTime;

      if (!isValid) {
        const reason = "Signature verification failed";

        this.emit("onVerificationFailed", {
          ...createBase(eventType, deliveryId),
          type: "verification_failed",
          verifyDurationMs,
          reason,
        });

        if (this.verificationFailedHandler) {
          try {
            await this.verificationFailedHandler(reason, headers);
          } catch {
            // Ignore errors from verification failed handler
          }
        }

        return complete(401, eventType, deliveryId, {
          ok: false,
          error: reason,
        });
      }

      this.emit("onVerificationSucceeded", {
        ...createBase(eventType, deliveryId),
        type: "verification_succeeded",
        verifyDurationMs,
      });
    }

    if (this.replayProtection) {
      const replayPolicy = this.replayProtection.policy;
      const replayStore = this.replayProtection.store;
      try {
        const providerReplayContext = this.provider.getReplayContext?.(
          headers,
          parsedBody,
        );
        const replayContext: ReplayContext = {
          provider: this.provider.name,
          eventType,
          deliveryId,
          replayKey: providerReplayContext?.replayKey,
          timestamp: providerReplayContext?.timestamp,
        };

        if (
          replayPolicy.timestampToleranceSeconds !== undefined &&
          replayContext.timestamp !== undefined
        ) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const ageInSeconds = Math.abs(nowSeconds - replayContext.timestamp);
          if (ageInSeconds > replayPolicy.timestampToleranceSeconds) {
            this.emit("onReplayFreshnessRejected", {
              ...createBase(eventType, deliveryId),
              type: "replay_freshness_rejected",
              timestamp: replayContext.timestamp,
              toleranceSeconds: replayPolicy.timestampToleranceSeconds,
            });
            return complete(409, eventType, deliveryId, {
              ok: false,
              error: REPLAY_TIMESTAMP_OUTSIDE_TOLERANCE_ERROR,
            });
          }
        }

        const replayKey = replayPolicy.key(replayContext);
        if (!replayKey) {
          this.emit("onReplaySkipped", {
            ...createBase(eventType, deliveryId),
            type: "replay_skipped",
            reason: "missing_key",
          });
        } else {
          const reserveResult = await replayStore.reserve(
            replayKey,
            replayPolicy.inFlightTtlSeconds,
          );
          if (reserveResult === "duplicate") {
            this.emit("onReplayDuplicate", {
              ...createBase(eventType, deliveryId),
              type: "replay_duplicate",
              replayKey,
              behavior: replayPolicy.onDuplicate,
            });
            if (replayPolicy.onDuplicate === "ignore") {
              return complete(200, eventType, deliveryId, { ok: true });
            }
            return complete(409, eventType, deliveryId, {
              ok: false,
              error: DUPLICATE_WEBHOOK_ERROR,
            });
          }

          reservedReplayKey = replayKey;
          replayStoreForRequest = replayStore;
          replayPolicyForRequest = replayPolicy;
          this.emit("onReplayReserved", {
            ...createBase(eventType, deliveryId),
            type: "replay_reserved",
            replayKey,
            inFlightTtlSeconds: replayPolicy.inFlightTtlSeconds,
            storeMode: "atomic",
          });
        }
      } catch (error) {
        if (reservedReplayKey && replayStoreForRequest) {
          try {
            await replayStoreForRequest.release(reservedReplayKey);
          } catch {
            // Ignore release failures after replay errors.
          }
          reservedReplayKey = undefined;
        }
        return failReplayProtection(error, eventType, deliveryId);
      }
    }

    // No event type or no handlers for this event → 204
    if (!eventType || !this.handlerEntries.has(eventType)) {
      const durationMs = performance.now() - startTime;
      this.emit("onEventUnhandled", {
        ...createBase(eventType, deliveryId),
        type: "event_unhandled",
        durationMs,
      });
      return completeWithReplay(204, eventType, deliveryId);
    }

    // Extract payload from body (for providers with envelope structures like Ragie)
    // If getPayload is not defined, use the entire parsed body
    const payloadToValidate = this.provider.getPayload
      ? this.provider.getPayload(parsedBody)
      : parsedBody;

    // Get the handler entry which contains both schema and handlers
    const entry = this.handlerEntries.get(eventType)!;
    const schema = entry.schema;
    let payload: unknown;

    if (schema) {
      const validateStartTime = performance.now();
      const result = schema.safeParse(payloadToValidate);
      const validateDurationMs = performance.now() - validateStartTime;

      if (!result.success) {
        const zodError = result.error as ZodError;

        this.emit("onSchemaValidationFailed", {
          ...createBase(eventType, deliveryId),
          type: "schema_validation_failed",
          validateDurationMs,
          error: zodError.message,
        });

        if (this.errorHandler) {
          try {
            await this.errorHandler(zodError, {
              eventType,
              deliveryId,
              payload: payloadToValidate,
            });
          } catch {
            // Ignore errors from error handler
          }
        }

        return completeWithReplay(400, eventType, deliveryId, {
          ok: false,
          error: "Schema validation failed",
        });
      }

      this.emit("onSchemaValidationSucceeded", {
        ...createBase(eventType, deliveryId),
        type: "schema_validation_succeeded",
        validateDurationMs,
      });

      payload = result.data;
    } else {
      payload = payloadToValidate;
    }

    // Build handler context
    const handlerContext: HandlerContext = {
      eventType,
      provider: this.provider.name,
      deliveryId,
      headers,
      rawBody: bodyString,
      receivedAt,
    };

    // Execute handlers sequentially
    const eventHandlers = entry.handlers;
    const handlerCount = eventHandlers.length;

    for (
      let handlerIndex = 0;
      handlerIndex < eventHandlers.length;
      handlerIndex++
    ) {
      const handler = eventHandlers[handlerIndex]!;

      this.emit("onHandlerStarted", {
        ...createBase(eventType, deliveryId),
        type: "handler_started",
        handlerIndex,
        handlerCount,
      });

      const handlerStartTime = performance.now();
      try {
        await handler(payload, handlerContext);
        const handlerDurationMs = performance.now() - handlerStartTime;

        this.emit("onHandlerSucceeded", {
          ...createBase(eventType, deliveryId),
          type: "handler_succeeded",
          handlerIndex,
          handlerCount,
          handlerDurationMs,
        });
      } catch (error) {
        const handlerDurationMs = performance.now() - handlerStartTime;
        const err = error instanceof Error ? error : new Error(String(error));

        this.emit("onHandlerFailed", {
          ...createBase(eventType, deliveryId),
          type: "handler_failed",
          handlerIndex,
          handlerCount,
          handlerDurationMs,
          error: err,
        });

        if (this.errorHandler) {
          try {
            await this.errorHandler(err, {
              eventType,
              deliveryId,
              payload,
            });
          } catch {
            // Ignore errors from error handler
          }
        }

        return completeWithReplay(500, eventType, deliveryId, {
          ok: false,
          error: "Handler execution failed",
        });
      }
    }

    return completeWithReplay(200, eventType, deliveryId, { ok: true });
  }

  /**
   * Get the provider instance (for adapters)
   */
  getProvider(): Provider<TProviderBrand> {
    return this.provider;
  }

  /**
   * Clone the builder for immutable operations
   */
  private clone(): WebhookBuilder<TProviderBrand> {
    const newBuilder = new WebhookBuilder(this.provider);

    // Copy handler entries (deep copy handlers array)
    for (const [name, entry] of this.handlerEntries) {
      newBuilder.handlerEntries.set(name, {
        schema: entry.schema,
        handlers: [...entry.handlers],
      });
    }

    // Copy error handlers
    newBuilder.errorHandler = this.errorHandler;
    newBuilder.verificationFailedHandler = this.verificationFailedHandler;
    newBuilder.maxBodyBytesLimit = this.maxBodyBytesLimit;
    newBuilder.replayProtection = this.replayProtection;

    // Copy observers
    newBuilder.observers.push(...this.observers);

    return newBuilder;
  }

  /**
   * Safely emit an observation event to all observers
   * Errors from observers are caught and ignored to prevent breaking webhook processing
   */
  private emit<K extends keyof WebhookObserver>(
    method: K,
    event: Parameters<NonNullable<WebhookObserver[K]>>[0],
  ): void {
    for (const observer of this.observers) {
      try {
        const handler = observer[method];
        if (handler) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (handler as any)(event);
        }
      } catch {
        // Swallow observer errors - they must never break webhook processing
      }
    }
  }

  /**
   * Get secret from environment variables based on provider name
   */
  private getEnvSecret(providerName: string): string | undefined {
    const envKey = `${providerName.toUpperCase()}_WEBHOOK_SECRET`;
    return process.env[envKey] || process.env.WEBHOOK_SECRET;
  }
}

/**
 * Create a webhook builder with a provider
 */
export function createWebhook<TProviderBrand extends string = string>(
  provider: Provider<TProviderBrand>,
): WebhookBuilder<TProviderBrand> {
  return new WebhookBuilder(provider);
}

// Re-export zod for convenience
export { z };
export type { ZodSchema };
