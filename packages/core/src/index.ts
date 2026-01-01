import { createHmac, timingSafeEqual } from "node:crypto";
import { z, type ZodSchema, type ZodError } from "zod";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Normalized headers with lowercase keys
 */
export type Headers = Record<string, string | undefined>;

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
 * Provider interface that webhook sources must implement
 */
export interface Provider<
  EventMap extends Record<string, ZodSchema> = Record<string, ZodSchema>,
> {
  /** Provider name (e.g., "github", "stripe") */
  readonly name: string;

  /** Schema map for event types */
  readonly schemas: EventMap;

  /** Optional default secret (can be overridden by adapters) */
  readonly secret?: string;

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
}

// ============================================================================
// Custom Provider Types
// ============================================================================

/**
 * Supported HMAC algorithms for signature verification
 */
export type HmacAlgorithm = "sha1" | "sha256" | "sha384" | "sha512";

/**
 * Configuration for creating a custom provider
 */
export interface ProviderConfig<
  EventMap extends Record<string, ZodSchema> = Record<string, ZodSchema>,
> {
  /** Provider name (e.g., "my-custom-webhook") */
  name: string;

  /** Schema map for event types */
  schemas: EventMap;

  /** Optional default secret */
  secret?: string;

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
   * If not provided, verification will be skipped (useful for development or trusted sources)
   */
  verify?: (
    rawBody: string | Buffer,
    headers: Headers,
    secret: string
  ) => boolean;

  /**
   * Optional: Extract the actual payload from the body
   * Useful for providers that wrap payloads in an envelope structure
   * (e.g., Ragie's {type, payload, nonce} format)
   * If not provided, the entire body is used as the payload
   */
  getPayload?: (body: unknown) => unknown;
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
 * .event('push', async (payload) => {
 *   console.log(payload.repository.name);
 * })
 *
 * // With context - access delivery ID, headers, etc.
 * .event('push', async (payload, context) => {
 *   console.log(`[${context.deliveryId}] Push to ${payload.repository.name}`);
 *   console.log(`Provider: ${context.provider}`);
 *   console.log(`Received at: ${context.receivedAt}`);
 * })
 * ```
 */
export type EventHandler<T> = (
  payload: T,
  context: HandlerContext
) => Promise<void> | void;

/**
 * Error handler function
 */
export type ErrorHandler = (
  error: Error,
  context: ErrorContext
) => Promise<void> | void;

/**
 * Verification failed handler function
 */
export type VerificationFailedHandler = (
  reason: string,
  headers: Headers
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
  | VerificationSucceededEvent
  | VerificationFailedEvent
  | SchemaValidationSucceededEvent
  | SchemaValidationFailedEvent
  | HandlerStartedEvent
  | HandlerSucceededEvent
  | HandlerFailedEvent
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
 *   .event('push', handler);
 * ```
 */
export interface WebhookObserver {
  /** Called when a webhook request is first received */
  onRequestReceived?: (event: RequestReceivedEvent) => void;

  /** Called when JSON parsing fails */
  onJsonParseFailed?: (event: JsonParseFailedEvent) => void;

  /** Called when no handler is registered for the event type */
  onEventUnhandled?: (event: EventUnhandledEvent) => void;

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
 *   .event('push', handler);
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
  headers: Record<string, string | string[] | undefined>
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
  options: HmacVerifyOptions
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
    secret: string
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
 * import { createProvider, createHmacVerifier, z } from '@better-webhook/core';
 *
 * const OrderEventSchema = z.object({
 *   orderId: z.string(),
 *   status: z.enum(['pending', 'completed', 'cancelled']),
 *   amount: z.number(),
 * });
 *
 * const myProvider = createProvider({
 *   name: 'my-ecommerce',
 *   schemas: {
 *     'order.created': OrderEventSchema,
 *     'order.updated': OrderEventSchema,
 *   },
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
 *   .event('order.created', async (payload) => {
 *     console.log('New order:', payload.orderId);
 *   });
 * ```
 */
export function createProvider<
  EventMap extends Record<string, ZodSchema> = Record<string, ZodSchema>,
>(config: ProviderConfig<EventMap>): Provider<EventMap> {
  const {
    name,
    schemas,
    secret,
    getEventType,
    getDeliveryId = () => undefined,
    verify = () => true, // Skip verification if not provided
    getPayload,
  } = config;

  return {
    name,
    schemas,
    secret,
    getEventType,
    getDeliveryId,
    verify,
    getPayload,
  };
}

/**
 * Create a custom webhook builder with inline configuration
 *
 * This is a convenience function that combines createProvider and createWebhook
 *
 * @example
 * ```ts
 * import { customWebhook, createHmacVerifier, z } from '@better-webhook/core';
 *
 * const PaymentEventSchema = z.object({
 *   paymentId: z.string(),
 *   amount: z.number(),
 *   currency: z.string(),
 * });
 *
 * const webhook = customWebhook({
 *   name: 'payment-provider',
 *   schemas: {
 *     'payment.completed': PaymentEventSchema,
 *     'payment.failed': PaymentEventSchema,
 *   },
 *   getEventType: (headers) => headers['x-webhook-event'],
 *   verify: createHmacVerifier({
 *     algorithm: 'sha256',
 *     signatureHeader: 'x-webhook-signature',
 *     signaturePrefix: 'v1=',
 *   }),
 * })
 *   .event('payment.completed', async (payload) => {
 *     console.log('Payment received:', payload.paymentId);
 *   })
 *   .event('payment.failed', async (payload) => {
 *     console.log('Payment failed:', payload.paymentId);
 *   });
 * ```
 */
export function customWebhook<
  EventMap extends Record<string, ZodSchema> = Record<string, ZodSchema>,
>(config: ProviderConfig<EventMap>): WebhookBuilder<EventMap> {
  const provider = createProvider(config);
  return new WebhookBuilder(provider);
}

// ============================================================================
// WebhookBuilder Class
// ============================================================================

/**
 * Infer the payload type from a Zod schema
 */
type InferPayload<S> = S extends ZodSchema<infer T> ? T : never;

/**
 * Fluent webhook builder with type-safe event handling
 */
export class WebhookBuilder<
  EventMap extends Record<string, ZodSchema> = Record<string, ZodSchema>,
> {
  private readonly provider: Provider<EventMap>;
  private readonly handlers: Map<
    string,
    ((payload: unknown, context: HandlerContext) => Promise<void> | void)[]
  > = new Map();
  private errorHandler?: ErrorHandler;
  private verificationFailedHandler?: VerificationFailedHandler;
  private readonly observers: WebhookObserver[] = [];

  constructor(provider: Provider<EventMap>) {
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
   *   .event('push', handler);
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
   *   .event('push', handler);
   * ```
   */
  observe(
    observer: WebhookObserver | WebhookObserver[]
  ): WebhookBuilder<EventMap> {
    const newBuilder = this.clone();
    const observersToAdd = Array.isArray(observer) ? observer : [observer];
    newBuilder.observers.push(...observersToAdd);
    return newBuilder;
  }

  /**
   * Register a handler for a specific event type
   * Returns a new builder instance for immutable chaining
   *
   * @param eventType - The event type to handle
   * @param handler - The handler function that receives the typed payload and context
   *
   * @example
   * ```ts
   * // Simple handler
   * .event('push', async (payload) => {
   *   console.log(payload.repository.name);
   * })
   *
   * // Handler with context
   * .event('push', async (payload, context) => {
   *   console.log(`[${context.deliveryId}] Push event`);
   *   console.log(`Headers:`, context.headers);
   * })
   * ```
   */
  event<E extends keyof EventMap & string>(
    eventType: E,
    handler: EventHandler<InferPayload<EventMap[E]>>
  ): WebhookBuilder<EventMap> {
    const newBuilder = this.clone();
    const existing = newBuilder.handlers.get(eventType) || [];
    existing.push(
      handler as (
        payload: unknown,
        context: HandlerContext
      ) => Promise<void> | void
    );
    newBuilder.handlers.set(eventType, existing);
    return newBuilder;
  }

  /**
   * Register an error handler
   * Returns a new builder instance for immutable chaining
   */
  onError(handler: ErrorHandler): WebhookBuilder<EventMap> {
    const newBuilder = this.clone();
    newBuilder.errorHandler = handler;
    return newBuilder;
  }

  /**
   * Register a verification failed handler
   * Returns a new builder instance for immutable chaining
   */
  onVerificationFailed(
    handler: VerificationFailedHandler
  ): WebhookBuilder<EventMap> {
    const newBuilder = this.clone();
    newBuilder.verificationFailedHandler = handler;
    return newBuilder;
  }

  /**
   * Process an incoming webhook request
   * Used by adapters to handle the webhook lifecycle
   */
  async process(options: ProcessOptions): Promise<ProcessResult> {
    const { rawBody, secret } = options;
    const startTime = performance.now();
    const receivedAt = new Date();

    // Normalize headers to lowercase
    const headers = normalizeHeaders(options.headers);

    // Convert raw body to string for consistent handling
    const bodyString =
      typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    const rawBodyBytes = Buffer.byteLength(bodyString, "utf-8");

    // Helper to create base observation fields
    const createBase = (
      eventType?: string,
      deliveryId?: string
    ): ObservationBase => ({
      provider: this.provider.name,
      eventType,
      deliveryId,
      rawBodyBytes,
      startTime,
      receivedAt,
    });

    // Helper to emit completed event and return result
    const complete = (
      status: number,
      eventType?: string,
      deliveryId?: string,
      body?: { ok: boolean; error?: string }
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

    // Emit request received
    this.emit("onRequestReceived", {
      ...createBase(),
      type: "request_received",
    });

    // Parse JSON body early (needed for getEventType and getPayload)
    let parsedBody: unknown;
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
    const deliveryId = this.provider.getDeliveryId(headers);

    // No event type or no handlers for this event → 204
    if (!eventType || !this.handlers.has(eventType)) {
      const durationMs = performance.now() - startTime;
      this.emit("onEventUnhandled", {
        ...createBase(eventType, deliveryId),
        type: "event_unhandled",
        durationMs,
      });
      return complete(204, eventType, deliveryId);
    }

    // Resolve secret: options.secret → provider.secret → env vars
    const resolvedSecret =
      secret || this.provider.secret || this.getEnvSecret(this.provider.name);

    // Verify signature if secret is available
    if (resolvedSecret) {
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

    // Extract payload from body (for providers with envelope structures like Ragie)
    // If getPayload is not defined, use the entire parsed body
    const payloadToValidate = this.provider.getPayload
      ? this.provider.getPayload(parsedBody)
      : parsedBody;

    // Validate against schema
    const schema = this.provider.schemas[eventType];
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

        return complete(400, eventType, deliveryId, {
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
    const eventHandlers = this.handlers.get(eventType) || [];
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

        return complete(500, eventType, deliveryId, {
          ok: false,
          error: "Handler execution failed",
        });
      }
    }

    return complete(200, eventType, deliveryId, { ok: true });
  }

  /**
   * Get the provider instance (for adapters)
   */
  getProvider(): Provider<EventMap> {
    return this.provider;
  }

  /**
   * Clone the builder for immutable operations
   */
  private clone(): WebhookBuilder<EventMap> {
    const newBuilder = new WebhookBuilder(this.provider);

    // Copy handlers
    for (const [event, handlers] of this.handlers) {
      newBuilder.handlers.set(event, [...handlers]);
    }

    // Copy error handlers
    newBuilder.errorHandler = this.errorHandler;
    newBuilder.verificationFailedHandler = this.verificationFailedHandler;

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
    event: Parameters<NonNullable<WebhookObserver[K]>>[0]
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
export function createWebhook<
  EventMap extends Record<string, ZodSchema> = Record<string, ZodSchema>,
>(provider: Provider<EventMap>): WebhookBuilder<EventMap> {
  return new WebhookBuilder(provider);
}

// Re-export zod for convenience
export { z };
export type { ZodSchema };
