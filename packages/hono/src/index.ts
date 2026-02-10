import { type Context } from "hono";
import { cloneRawRequest } from "hono/request";
import {
  type WebhookBuilder,
  type ProcessResult,
  type WebhookObserver,
} from "@better-webhook/core";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the Hono adapter
 */
export interface HonoAdapterOptions {
  /** Webhook secret for signature verification (overrides provider secret) */
  secret?: string;

  /** Callback invoked on successful webhook processing */
  onSuccess?: (eventType: string) => void | Promise<void>;

  /**
   * Observer(s) for webhook lifecycle events.
   * Use this to add observability without modifying the webhook builder.
   */
  observer?: WebhookObserver | WebhookObserver[];
}

/**
 * Hono handler type
 */
export type HonoHandler<C extends Context = Context> = (
  c: C,
) => Response | Promise<Response>;

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

const decoder = new TextDecoder();

async function readRawBody(c: Context): Promise<string> {
  try {
    const arrayBuffer = await c.req.arrayBuffer();
    return decoder.decode(arrayBuffer);
  } catch (error) {
    try {
      const clonedRequest = await cloneRawRequest(c.req);
      const arrayBuffer = await clonedRequest.arrayBuffer();
      return decoder.decode(arrayBuffer);
    } catch (cloneError) {
      const cause =
        error instanceof Error && cloneError instanceof Error
          ? new AggregateError([error, cloneError], "Failed to read request body")
          : cloneError;
      throw new Error("Failed to read request body", { cause });
    }
  }
}

// ============================================================================
// Hono Adapter
// ============================================================================

/**
 * Convert a webhook builder to a Hono handler
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { github } from "@better-webhook/github";
 * import { push } from "@better-webhook/github/events";
 * import { toHono } from "@better-webhook/hono";
 *
 * const app = new Hono();
 *
 * const webhook = github()
 *   .event(push, async (payload) => {
 *     console.log(`Push to ${payload.repository.name}`);
 *   });
 *
 * app.post("/webhooks/github", toHono(webhook));
 *
 * export default app;
 * ```
 *
 * @param webhook - The webhook builder instance
 * @param options - Adapter options
 * @returns A Hono handler function
 */
export function toHono<
  TProviderBrand extends string = string,
  C extends Context = Context,
>(
  webhook: WebhookBuilder<TProviderBrand>,
  options?: HonoAdapterOptions,
): HonoHandler<C> {
  // Apply observer(s) if provided
  const instrumentedWebhook = options?.observer
    ? webhook.observe(options.observer)
    : webhook;

  return async (c: C): Promise<Response> => {
    if (c.req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    }

    let rawBody: string;
    try {
      rawBody = await readRawBody(c);
    } catch {
      return jsonResponse(
        { ok: false, error: "Failed to read request body" },
        400,
      );
    }

    const requestHeaders = c.req.header();
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(requestHeaders)) {
      if (value !== undefined) {
        headers[key.toLowerCase()] = value;
      }
    }

    let result: ProcessResult;
    try {
      result = await instrumentedWebhook.process({
        headers,
        rawBody,
        secret: options?.secret,
      });
    } catch {
      return jsonResponse({ ok: false, error: "Internal server error" }, 500);
    }

    if (result.status === 200 && result.eventType && options?.onSuccess) {
      try {
        await options.onSuccess(result.eventType);
      } catch {
        // Ignore errors from onSuccess callback
      }
    }

    if (result.status === 204) {
      return new Response(null, { status: 204 });
    }

    return jsonResponse(
      result.body ?? { ok: result.status === 200 },
      result.status,
    );
  };
}

/**
 * Convert a webhook builder to a Hono handler for Node.js runtimes
 *
 * This is a convenience wrapper for `toHono` to make Node.js usage explicit.
 */
export function toHonoNode<
  TProviderBrand extends string = string,
  C extends Context = Context,
>(
  webhook: WebhookBuilder<TProviderBrand>,
  options?: HonoAdapterOptions,
): HonoHandler<C> {
  return toHono<TProviderBrand, C>(webhook, options);
}

// Re-export types for convenience
export type { ProcessResult };
