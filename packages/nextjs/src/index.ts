import {
  type WebhookBuilder,
  type ProcessResult,
  type WebhookObserver,
} from "@better-webhook/core";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the Next.js adapter
 */
export interface NextJSAdapterOptions {
  /** Webhook secret for signature verification (overrides provider secret) */
  secret?: string;

  /** Maximum request body size in bytes (optional, returns 413 when exceeded) */
  maxBodyBytes?: number;

  /**
   * Callback invoked only when `result.status === 200`.
   * Observer `CompletedEvent.success` can still be `true` for both 200 and 204.
   */
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
   * export const POST = toNextJS(webhook, {
   *   observer: stats.observer,
   * });
   * ```
   */
  observer?: WebhookObserver | WebhookObserver[];
}

/**
 * Next.js route handler type
 */
export type NextJSHandler = (request: Request) => Promise<Response>;

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a JSON response
 */
function jsonResponse(
  body: Record<string, unknown> | null,
  status: number,
): Response {
  if (body === null) {
    return new Response(null, { status });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// ============================================================================
// Next.js Adapter
// ============================================================================

/**
 * Convert a webhook builder to a Next.js route handler
 *
 * @example
 * ```ts
 * // app/api/webhooks/github/route.ts
 * import { github } from '@better-webhook/github';
 * import { push } from '@better-webhook/github/events';
 * import { toNextJS } from '@better-webhook/nextjs';
 *
 * const webhook = github()
 *   .event(push, async (payload) => {
 *     console.log(`Push to ${payload.repository.name}`);
 *   });
 *
 * export const POST = toNextJS(webhook);
 * ```
 *
 * @param webhook - The webhook builder instance
 * @param options - Adapter options
 * @returns A Next.js route handler function
 */
export function toNextJS<TProviderBrand extends string = string>(
  webhook: WebhookBuilder<TProviderBrand>,
  options?: NextJSAdapterOptions,
): NextJSHandler {
  // Apply observer(s) if provided
  const instrumentedWebhook = options?.observer
    ? webhook.observe(options.observer)
    : webhook;

  return async (request: Request): Promise<Response> => {
    // Enforce POST method
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            Allow: "POST",
          },
        },
      );
    }

    // Read raw body
    let rawBody: string;
    try {
      const arrayBuffer = await request.arrayBuffer();
      rawBody = new TextDecoder().decode(arrayBuffer);
    } catch {
      return jsonResponse(
        { ok: false, error: "Failed to read request body" },
        400,
      );
    }

    // Collect headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Process the webhook
    const result: ProcessResult = await instrumentedWebhook.process({
      headers,
      rawBody,
      secret: options?.secret,
      maxBodyBytes: options?.maxBodyBytes,
    });

    // Call onSuccess if applicable
    if (result.status === 200 && result.eventType && options?.onSuccess) {
      try {
        await options.onSuccess(result.eventType);
      } catch {
        // Ignore errors from onSuccess callback
      }
    }

    // Map result to Response
    if (result.status === 204) {
      return new Response(null, { status: 204 });
    }

    return jsonResponse(
      result.body ?? { ok: result.status === 200 },
      result.status,
    );
  };
}

// Re-export types for convenience
export type { ProcessResult };
