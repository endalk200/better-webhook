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
   * Response status to use for verified requests when no matching handler is registered.
   * Defaults to `204`.
   */
  readonly verifiedUnhandledStatus?: 200 | 204;

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
   * Response status to use for verified requests when no matching handler is registered.
   * Defaults to `204`.
   */
  verifiedUnhandledStatus?: 200 | 204;

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
// Instrumentation Types
// ============================================================================

export interface WebhookInstrumentationContext {
  provider: string;
  eventType?: string;
  deliveryId?: string;
  rawBodyBytes: number;
  receivedAt: Date;
}

export interface WebhookBodyTooLargeData {
  maxBodyBytes: number;
}

export interface WebhookJsonParseFailedData {
  error: string;
  durationMs: number;
}

export interface WebhookVerificationSucceededData {
  durationMs: number;
}

export interface WebhookVerificationFailedData {
  reason: string;
  durationMs: number;
}

export interface WebhookReplaySkippedData {
  reason: "missing_key";
}

export interface WebhookReplayFreshnessRejectedData {
  timestamp: number;
  toleranceSeconds: number;
}

export interface WebhookReplayReservedData {
  replayKey: string;
  inFlightTtlSeconds: number;
}

export interface WebhookReplayDuplicateData {
  replayKey: string;
  behavior: ReplayDuplicateBehavior;
}

export interface WebhookReplayCommittedData {
  replayKey: string;
  ttlSeconds: number;
}

export type ReplayReleaseReason = "processing_failed" | "event_unhandled";

export interface WebhookReplayReleasedData {
  replayKey: string;
  reason: ReplayReleaseReason;
}

export interface WebhookEventUnhandledData {
  durationMs: number;
}

export interface WebhookSchemaValidationSucceededData {
  durationMs: number;
}

export interface WebhookSchemaValidationFailedData {
  durationMs: number;
  error: string;
}

export interface WebhookHandlerStartedData {
  handlerIndex: number;
  handlerCount: number;
}

export interface WebhookHandlerSucceededData {
  handlerIndex: number;
  handlerCount: number;
  durationMs: number;
}

export interface WebhookHandlerFailedData {
  handlerIndex: number;
  handlerCount: number;
  durationMs: number;
  error: Error;
}

export interface WebhookCompletedData {
  status: number;
  durationMs: number;
  success: boolean;
}

export interface WebhookRequestInstrumentation {
  wrapHandler?(
    next: () => Promise<void>,
    data: WebhookHandlerStartedData,
  ): Promise<void> | void;
  onBodyTooLarge?(data: WebhookBodyTooLargeData): void;
  onJsonParseFailed?(data: WebhookJsonParseFailedData): void;
  onVerificationSucceeded?(data: WebhookVerificationSucceededData): void;
  onVerificationFailed?(data: WebhookVerificationFailedData): void;
  onReplaySkipped?(data: WebhookReplaySkippedData): void;
  onReplayFreshnessRejected?(data: WebhookReplayFreshnessRejectedData): void;
  onReplayReserved?(data: WebhookReplayReservedData): void;
  onReplayDuplicate?(data: WebhookReplayDuplicateData): void;
  onReplayCommitted?(data: WebhookReplayCommittedData): void;
  onReplayReleased?(data: WebhookReplayReleasedData): void;
  onEventUnhandled?(data: WebhookEventUnhandledData): void;
  onSchemaValidationSucceeded?(
    data: WebhookSchemaValidationSucceededData,
  ): void;
  onSchemaValidationFailed?(data: WebhookSchemaValidationFailedData): void;
  onHandlerStarted?(data: WebhookHandlerStartedData): void;
  onHandlerSucceeded?(data: WebhookHandlerSucceededData): void;
  onHandlerFailed?(data: WebhookHandlerFailedData): void;
  onCompleted?(data: WebhookCompletedData): void;
}

export interface WebhookInstrumentation {
  onRequestStart?(
    context: WebhookInstrumentationContext,
  ): WebhookRequestInstrumentation | void;
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
      if (!force && removed >= this.cleanupBatchSize) {
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

// ============================================================================
// Utility Functions
// ============================================================================

const blockedHeaderKeys = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Normalize headers to lowercase keys with string values
 */
export function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Headers {
  const normalized: Headers = Object.create(null) as Headers;
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (
      blockedHeaderKeys.has(normalizedKey) ||
      normalizedKey.startsWith("__")
    ) {
      continue;
    }

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
    verifiedUnhandledStatus,
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
    verifiedUnhandledStatus,
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
  private readonly instrumentations: WebhookInstrumentation[] = [];
  private replayProtection?: {
    store: ReplayStore;
    policy: ResolvedReplayPolicy;
  };

  constructor(provider: Provider<TProviderBrand>) {
    this.provider = provider;
  }

  /**
   * Register instrumentation for webhook lifecycle events.
   * Returns a new builder instance for immutable chaining.
   */
  instrument(
    instrumentation: WebhookInstrumentation | WebhookInstrumentation[],
  ): WebhookBuilder<TProviderBrand> {
    const newBuilder = this.clone();
    const instrumentationsToAdd = Array.isArray(instrumentation)
      ? instrumentation
      : [instrumentation];
    newBuilder.instrumentations.push(...instrumentationsToAdd);
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
    const receivedAt = new Date();

    // Normalize headers to lowercase
    const headers = normalizeHeaders(options.headers);

    const rawBodyBytes =
      typeof rawBody === "string"
        ? Buffer.byteLength(rawBody, "utf-8")
        : rawBody.byteLength;

    const instrumentationContext: WebhookInstrumentationContext = {
      provider: this.provider.name,
      rawBodyBytes,
      receivedAt,
    };

    const requestStartTime = performance.now();
    const requestInstrumentations = this.createRequestInstrumentations(
      instrumentationContext,
    );

    let parsedBody: unknown;
    let eventType: string | undefined;
    let deliveryId: string | undefined;
    let reservedReplayKey: string | undefined;
    let replayStoreForRequest: ReplayStore | undefined;
    let replayPolicyForRequest: ResolvedReplayPolicy | undefined;
    let completedResult: ProcessResult | undefined;

    // Helper to emit completed event and return result
    const complete = (
      status: number,
      eventType?: string,
      deliveryId?: string,
      body?: { ok: boolean; error?: string },
    ): ProcessResult => {
      if (completedResult) {
        return completedResult;
      }

      const durationMs = performance.now() - requestStartTime;
      instrumentationContext.eventType = eventType;
      instrumentationContext.deliveryId = deliveryId;
      this.emitRequestInstrumentation(requestInstrumentations, "onCompleted", {
        status,
        durationMs,
        success: status === 200 || status === 204,
      });
      completedResult = { status, eventType, body };
      return completedResult;
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
      options?: {
        commitReplayKey?: boolean;
        releaseReason?: ReplayReleaseReason;
      },
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
        const shouldCommitReplay =
          options?.commitReplayKey ?? (status === 200 || status === 204);
        if (shouldCommitReplay) {
          await replayStore.commit(replayKey, replayPolicy.ttlSeconds);
          this.emitRequestInstrumentation(
            requestInstrumentations,
            "onReplayCommitted",
            {
              replayKey,
              ttlSeconds: replayPolicy.ttlSeconds,
            },
          );
        } else {
          const releaseReason = options?.releaseReason ?? "processing_failed";
          await replayStore.release(replayKey);
          this.emitRequestInstrumentation(
            requestInstrumentations,
            "onReplayReleased",
            {
              replayKey,
              reason: releaseReason,
            },
          );
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
      options?: {
        commitReplayKey?: boolean;
        releaseReason?: ReplayReleaseReason;
      },
    ): Promise<ProcessResult> => {
      const replayFailure = await finalizeReplay(
        status,
        eventType,
        deliveryId,
        options,
      );
      if (replayFailure) {
        return replayFailure;
      }
      return complete(status, eventType, deliveryId, body);
    };

    const effectiveMaxBodyBytes = maxBodyBytes ?? this.maxBodyBytesLimit;
    if (
      effectiveMaxBodyBytes !== undefined &&
      (!Number.isInteger(effectiveMaxBodyBytes) || effectiveMaxBodyBytes <= 0)
    ) {
      throw new RangeError("maxBodyBytes must be a positive integer");
    }

    try {
      deliveryId = this.provider.getDeliveryId(headers);
      instrumentationContext.deliveryId = deliveryId;

      if (
        effectiveMaxBodyBytes !== undefined &&
        rawBodyBytes > effectiveMaxBodyBytes
      ) {
        this.emitRequestInstrumentation(
          requestInstrumentations,
          "onBodyTooLarge",
          {
            maxBodyBytes: effectiveMaxBodyBytes,
          },
        );
        return complete(413, undefined, deliveryId, {
          ok: false,
          error: "Payload too large",
        });
      }

      const bodyString =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

      const parseStartTime = performance.now();
      try {
        parsedBody = JSON.parse(bodyString);
      } catch (e) {
        const durationMs = performance.now() - parseStartTime;
        const error = e instanceof Error ? e.message : "Invalid JSON";
        this.emitRequestInstrumentation(
          requestInstrumentations,
          "onJsonParseFailed",
          {
            durationMs,
            error,
          },
        );
        return complete(400, undefined, deliveryId, {
          ok: false,
          error: "Invalid JSON body",
        });
      }

      eventType = this.provider.getEventType(headers, parsedBody);
      instrumentationContext.eventType = eventType;

      const resolvedSecret =
        secret || this.provider.secret || this.getEnvSecret(this.provider.name);

      if (this.provider.verification !== "disabled") {
        if (!resolvedSecret) {
          const reason = "Missing webhook secret";

          this.emitRequestInstrumentation(
            requestInstrumentations,
            "onVerificationFailed",
            {
              reason,
              durationMs: 0,
            },
          );

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

          this.emitRequestInstrumentation(
            requestInstrumentations,
            "onVerificationFailed",
            {
              reason,
              durationMs: verifyDurationMs,
            },
          );

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

        this.emitRequestInstrumentation(
          requestInstrumentations,
          "onVerificationSucceeded",
          {
            durationMs: verifyDurationMs,
          },
        );
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
              this.emitRequestInstrumentation(
                requestInstrumentations,
                "onReplayFreshnessRejected",
                {
                  timestamp: replayContext.timestamp,
                  toleranceSeconds: replayPolicy.timestampToleranceSeconds,
                },
              );
              return complete(409, eventType, deliveryId, {
                ok: false,
                error: REPLAY_TIMESTAMP_OUTSIDE_TOLERANCE_ERROR,
              });
            }
          }

          const replayKey = replayPolicy.key(replayContext);
          if (!replayKey) {
            this.emitRequestInstrumentation(
              requestInstrumentations,
              "onReplaySkipped",
              {
                reason: "missing_key",
              },
            );
          } else {
            const reserveResult = await replayStore.reserve(
              replayKey,
              replayPolicy.inFlightTtlSeconds,
            );
            if (reserveResult === "duplicate") {
              this.emitRequestInstrumentation(
                requestInstrumentations,
                "onReplayDuplicate",
                {
                  replayKey,
                  behavior: replayPolicy.onDuplicate,
                },
              );
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
            this.emitRequestInstrumentation(
              requestInstrumentations,
              "onReplayReserved",
              {
                replayKey,
                inFlightTtlSeconds: replayPolicy.inFlightTtlSeconds,
              },
            );
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

      if (!eventType || !this.handlerEntries.has(eventType)) {
        const unhandledStatus = this.provider.verifiedUnhandledStatus ?? 204;
        const durationMs = performance.now() - requestStartTime;
        this.emitRequestInstrumentation(
          requestInstrumentations,
          "onEventUnhandled",
          {
            durationMs,
          },
        );
        return completeWithReplay(
          unhandledStatus,
          eventType,
          deliveryId,
          undefined,
          {
            commitReplayKey: false,
            releaseReason: "event_unhandled",
          },
        );
      }

      const payloadToValidate = this.provider.getPayload
        ? this.provider.getPayload(parsedBody)
        : parsedBody;

      const entry = this.handlerEntries.get(eventType)!;
      const schema = entry.schema;
      let payload: unknown;

      if (schema) {
        const validateStartTime = performance.now();
        const result = schema.safeParse(payloadToValidate);
        const validateDurationMs = performance.now() - validateStartTime;

        if (!result.success) {
          const zodError = result.error as ZodError;

          this.emitRequestInstrumentation(
            requestInstrumentations,
            "onSchemaValidationFailed",
            {
              durationMs: validateDurationMs,
              error: zodError.message,
            },
          );

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

        this.emitRequestInstrumentation(
          requestInstrumentations,
          "onSchemaValidationSucceeded",
          {
            durationMs: validateDurationMs,
          },
        );

        payload = result.data;
      } else {
        payload = payloadToValidate;
      }

      const handlerContext: HandlerContext = {
        eventType,
        provider: this.provider.name,
        deliveryId,
        headers,
        rawBody: bodyString,
        receivedAt,
      };

      const eventHandlers = entry.handlers;
      const handlerCount = eventHandlers.length;

      for (
        let handlerIndex = 0;
        handlerIndex < eventHandlers.length;
        handlerIndex++
      ) {
        const handler = eventHandlers[handlerIndex]!;
        const handlerData: WebhookHandlerStartedData = {
          handlerIndex,
          handlerCount,
        };

        this.emitRequestInstrumentation(
          requestInstrumentations,
          "onHandlerStarted",
          handlerData,
        );

        const handlerStartTime = performance.now();
        try {
          await this.executeWithHandlerInstrumentation(
            requestInstrumentations,
            handlerData,
            async () => {
              await handler(payload, handlerContext);
            },
          );
          const handlerDurationMs = performance.now() - handlerStartTime;

          this.emitRequestInstrumentation(
            requestInstrumentations,
            "onHandlerSucceeded",
            {
              handlerIndex,
              handlerCount,
              durationMs: handlerDurationMs,
            },
          );
        } catch (error) {
          const handlerDurationMs = performance.now() - handlerStartTime;
          const err = error instanceof Error ? error : new Error(String(error));

          this.emitRequestInstrumentation(
            requestInstrumentations,
            "onHandlerFailed",
            {
              handlerIndex,
              handlerCount,
              durationMs: handlerDurationMs,
              error: err,
            },
          );

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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.errorHandler) {
        try {
          await this.errorHandler(err, {
            eventType: eventType ?? "unknown",
            deliveryId,
            payload: parsedBody,
          });
        } catch {
          // Ignore errors from error handler
        }
      }

      return completeWithReplay(500, eventType, deliveryId, {
        ok: false,
        error: "Internal server error",
      });
    }
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

    // Copy instrumentation
    newBuilder.instrumentations.push(...this.instrumentations);

    return newBuilder;
  }

  private createRequestInstrumentations(
    context: WebhookInstrumentationContext,
  ): WebhookRequestInstrumentation[] {
    const requestInstrumentations: WebhookRequestInstrumentation[] = [];
    for (const instrumentation of this.instrumentations) {
      try {
        const requestInstrumentation =
          instrumentation.onRequestStart?.(context);
        if (requestInstrumentation) {
          requestInstrumentations.push(requestInstrumentation);
        }
      } catch {
        // Swallow instrumentation errors - they must never break webhook processing
      }
    }
    return requestInstrumentations;
  }

  private emitRequestInstrumentation<
    K extends keyof WebhookRequestInstrumentation,
  >(
    requestInstrumentations: WebhookRequestInstrumentation[],
    method: K,
    data: Parameters<NonNullable<WebhookRequestInstrumentation[K]>>[0],
  ): void {
    for (const requestInstrumentation of requestInstrumentations) {
      try {
        const handler = requestInstrumentation[method];
        if (handler) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (handler as any)(data);
        }
      } catch {
        // Swallow instrumentation errors - they must never break webhook processing
      }
    }
  }

  private async executeWithHandlerInstrumentation(
    requestInstrumentations: WebhookRequestInstrumentation[],
    data: WebhookHandlerStartedData,
    executeHandler: () => Promise<void>,
  ): Promise<void> {
    const runWithInstrumentation = async (index: number): Promise<void> => {
      const requestInstrumentation = requestInstrumentations[index];
      if (!requestInstrumentation) {
        await executeHandler();
        return;
      }

      const wrapHandler = requestInstrumentation.wrapHandler;
      if (!wrapHandler) {
        await runWithInstrumentation(index + 1);
        return;
      }

      let nextPromise: Promise<void> | undefined;
      const next = (): Promise<void> => {
        nextPromise ??= runWithInstrumentation(index + 1);
        return nextPromise;
      };

      try {
        await wrapHandler(next, data);
        if (!nextPromise) {
          await runWithInstrumentation(index + 1);
          return;
        }

        await nextPromise;
      } catch {
        if (nextPromise) {
          await nextPromise;
          return;
        }

        await runWithInstrumentation(index + 1);
      }
    };

    await runWithInstrumentation(0);
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
