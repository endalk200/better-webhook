import {
  type WebhookBuilder,
  type ProcessResult,
  type ZodSchema,
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

  /** Callback invoked on successful webhook processing */
  onSuccess?: (eventType: string) => void | Promise<void>;
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
  status: number
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
 * import { toNextJS } from '@better-webhook/nextjs';
 *
 * const webhook = github()
 *   .event('push', async (payload) => {
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
export function toNextJS<EventMap extends Record<string, ZodSchema>>(
  webhook: WebhookBuilder<EventMap>,
  options?: NextJSAdapterOptions
): NextJSHandler {
  return async (request: Request): Promise<Response> => {
    // Enforce POST method
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    }

    // Read raw body
    let rawBody: string;
    try {
      const arrayBuffer = await request.arrayBuffer();
      rawBody = new TextDecoder().decode(arrayBuffer);
    } catch {
      return jsonResponse(
        { ok: false, error: "Failed to read request body" },
        400
      );
    }

    // Collect headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Process the webhook
    const result: ProcessResult = await webhook.process({
      headers,
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

    // Map result to Response
    if (result.status === 204) {
      return new Response(null, { status: 204 });
    }

    return jsonResponse(
      result.body || { ok: result.status === 200 },
      result.status
    );
  };
}

// Re-export types for convenience
export type { ProcessResult };
