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

  /** Extract event type from headers */
  getEventType(headers: Headers): string | undefined;

  /** Extract delivery ID from headers */
  getDeliveryId(headers: Headers): string | undefined;

  /** Verify signature of the payload */
  verify(rawBody: string | Buffer, headers: Headers, secret: string): boolean;
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

  /** Extract event type from headers */
  getEventType: (headers: Headers) => string | undefined;

  /** Extract delivery ID from headers (optional, defaults to undefined) */
  getDeliveryId?: (headers: Headers) => string | undefined;

  /**
   * Custom verification function.
   * If not provided, verification will be skipped (useful for development or trusted sources)
   */
  verify?: (
    rawBody: string | Buffer,
    headers: Headers,
    secret: string,
  ) => boolean;
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
  } = config;

  return {
    name,
    schemas,
    secret,
    getEventType,
    getDeliveryId,
    verify,
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

  constructor(provider: Provider<EventMap>) {
    this.provider = provider;
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
    handler: EventHandler<InferPayload<EventMap[E]>>,
  ): WebhookBuilder<EventMap> {
    const newBuilder = this.clone();
    const existing = newBuilder.handlers.get(eventType) || [];
    existing.push(
      handler as (
        payload: unknown,
        context: HandlerContext,
      ) => Promise<void> | void,
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
    handler: VerificationFailedHandler,
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

    // Normalize headers to lowercase
    const headers = normalizeHeaders(options.headers);

    // Get event type
    const eventType = this.provider.getEventType(headers);
    const deliveryId = this.provider.getDeliveryId(headers);

    // No event type or no handlers for this event → 204
    if (!eventType || !this.handlers.has(eventType)) {
      return { status: 204 };
    }

    // Resolve secret: options.secret → provider.secret → env vars
    const resolvedSecret =
      secret || this.provider.secret || this.getEnvSecret(this.provider.name);

    // Verify signature if secret is available
    if (resolvedSecret) {
      const isValid = this.provider.verify(rawBody, headers, resolvedSecret);

      if (!isValid) {
        const reason = "Signature verification failed";

        if (this.verificationFailedHandler) {
          try {
            await this.verificationFailedHandler(reason, headers);
          } catch {
            // Ignore errors from verification failed handler
          }
        }

        return {
          status: 401,
          body: { ok: false, error: reason },
        };
      }
    }

    // Parse JSON body
    let parsedBody: unknown;
    try {
      const bodyString =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
      parsedBody = JSON.parse(bodyString);
    } catch {
      return {
        status: 400,
        body: { ok: false, error: "Invalid JSON body" },
      };
    }

    // Validate against schema
    const schema = this.provider.schemas[eventType];
    let payload: unknown;

    if (schema) {
      const result = schema.safeParse(parsedBody);
      if (!result.success) {
        const zodError = result.error as ZodError;

        if (this.errorHandler) {
          try {
            await this.errorHandler(zodError, {
              eventType,
              deliveryId,
              payload: parsedBody,
            });
          } catch {
            // Ignore errors from error handler
          }
        }

        return {
          status: 400,
          body: { ok: false, error: "Schema validation failed" },
        };
      }
      payload = result.data;
    } else {
      payload = parsedBody;
    }

    // Build handler context
    const bodyString =
      typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

    const handlerContext: HandlerContext = {
      eventType,
      provider: this.provider.name,
      headers,
      rawBody: bodyString,
      receivedAt: new Date(),
    };

    // Execute handlers sequentially
    const eventHandlers = this.handlers.get(eventType) || [];

    for (const handler of eventHandlers) {
      try {
        await handler(payload, handlerContext);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

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

        return {
          status: 500,
          eventType,
          body: { ok: false, error: "Handler execution failed" },
        };
      }
    }

    return {
      status: 200,
      eventType,
      body: { ok: true },
    };
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

    return newBuilder;
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
