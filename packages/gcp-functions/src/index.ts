import {
  type WebhookBuilder,
  type ProcessResult,
  type WebhookObserver,
} from "@better-webhook/core";

// ============================================================================
// Types
// ============================================================================

/**
 * GCP Cloud Functions request interface (Express-compatible)
 * Compatible with both 1st and 2nd generation Cloud Functions
 */
export interface GCPFunctionRequest {
  /** HTTP request headers */
  headers: Record<string, string | string[] | undefined>;

  /** Request body (may be parsed JSON, Buffer, or string depending on configuration) */
  body: unknown;

  /**
   * Raw request body as Buffer
   * Available when using Functions Framework with rawBody option enabled
   */
  rawBody?: Buffer;

  /** HTTP method (GET, POST, etc.) */
  method: string;
}

/**
 * GCP Cloud Functions response interface (Express-compatible)
 */
export interface GCPFunctionResponse {
  /** Set HTTP status code */
  status(code: number): GCPFunctionResponse;

  /** Send JSON response */
  json(body: unknown): GCPFunctionResponse;

  /** End response without body */
  end(): GCPFunctionResponse;

  /** Set response header */
  set(header: string, value: string): GCPFunctionResponse;
}

/**
 * Options for the GCP Cloud Functions adapter
 */
export interface GCPFunctionAdapterOptions {
  /** Webhook secret for signature verification (overrides provider secret) */
  secret?: string;

  /** Callback invoked on successful webhook processing */
  onSuccess?: (eventType: string) => void | Promise<void>;

  /**
   * Observer(s) for webhook lifecycle events.
   * Use this to add observability without modifying the webhook builder.
   *
   * @example
   * ```ts
   * import { createWebhookStats } from '@better-webhook/core';
   *
   * const stats = createWebhookStats();
   *
   * http('webhookHandler', toGCPFunction(webhook, {
   *   observer: stats.observer,
   * }));
   * ```
   */
  observer?: WebhookObserver | WebhookObserver[];
}

/**
 * GCP Cloud Functions handler type
 */
export type GCPFunctionHandler = (
  req: GCPFunctionRequest,
  res: GCPFunctionResponse,
) => Promise<void>;

// ============================================================================
// GCP Cloud Functions Adapter
// ============================================================================

/**
 * Convert a webhook builder to a GCP Cloud Functions handler
 *
 * @important For signature verification to work correctly, ensure raw body is available.
 * The Functions Framework provides `req.rawBody` when configured appropriately.
 *
 * @example
 * ```ts
 * // index.ts (2nd Gen Cloud Functions)
 * import { http } from '@google-cloud/functions-framework';
 * import { ragie } from '@better-webhook/ragie';
 * import { document_status_updated } from '@better-webhook/ragie/events';
 * import { toGCPFunction } from '@better-webhook/gcp-functions';
 *
 * const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET })
 *   .event(document_status_updated, async (payload) => {
 *     console.log(`Document ${payload.document_id} is now ${payload.status}`);
 *   });
 *
 * http('webhookHandler', toGCPFunction(webhook));
 * ```
 *
 * @example
 * ```ts
 * // 1st Gen Cloud Functions (exports style)
 * import { ragie } from '@better-webhook/ragie';
 * import { document_status_updated } from '@better-webhook/ragie/events';
 * import { toGCPFunction } from '@better-webhook/gcp-functions';
 *
 * const webhook = ragie()
 *   .event(document_status_updated, async (payload) => {
 *     console.log(`Document ${payload.document_id} is now ${payload.status}`);
 *   });
 *
 * export const webhookHandler = toGCPFunction(webhook);
 * ```
 *
 * @param webhook - The webhook builder instance
 * @param options - Adapter options
 * @returns A GCP Cloud Functions handler function
 */
export function toGCPFunction<TProviderBrand extends string = string>(
  webhook: WebhookBuilder<TProviderBrand>,
  options?: GCPFunctionAdapterOptions,
): GCPFunctionHandler {
  // Apply observer(s) if provided
  const instrumentedWebhook = options?.observer
    ? webhook.observe(options.observer)
    : webhook;

  return async (
    req: GCPFunctionRequest,
    res: GCPFunctionResponse,
  ): Promise<void> => {
    // Enforce POST method
    if (req.method !== "POST") {
      res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
      return;
    }

    // Get raw body - check multiple sources for compatibility
    let rawBody: string | Buffer;

    if (req.rawBody) {
      // Functions Framework provides rawBody when configured
      rawBody = req.rawBody;
    } else if (Buffer.isBuffer(req.body)) {
      // Body is already a Buffer
      rawBody = req.body;
    } else if (typeof req.body === "string") {
      // Body is a string
      rawBody = req.body;
    } else if (req.body && typeof req.body === "object") {
      // Body was parsed as JSON - stringify it back
      // Note: This may not preserve the exact original payload for signature verification
      try {
        rawBody = JSON.stringify(req.body);
      } catch {
        res.status(400).json({
          ok: false,
          error:
            "Unable to process request body. For signature verification, ensure raw body is available.",
        });
        return;
      }
    } else {
      res.status(400).json({
        ok: false,
        error: "Request body is required",
      });
      return;
    }

    // Process the webhook
    const result: ProcessResult = await instrumentedWebhook.process({
      headers: req.headers,
      rawBody,
      secret: options?.secret,
    });

    // Call onSuccess if applicable
    if (result.status === 200 && result.eventType && options?.onSuccess) {
      try {
        await options.onSuccess(result.eventType);
      } catch {
        // Ignore errors from onSuccess callback
      }
    }

    // Send response
    if (result.status === 204) {
      res.status(204).end();
      return;
    }

    res.status(result.status).json(
      result.body || {
        ok: result.status === 200,
        eventType: result.eventType,
      },
    );
  };
}

// Re-export types for convenience
export type { ProcessResult };
