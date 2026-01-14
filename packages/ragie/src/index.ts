import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookBuilder,
  type Provider,
  type Headers,
} from "@better-webhook/core";

// Re-export types for provider brand (lightweight, no runtime import)
export type { RagieProvider } from "./events.js";

// Re-export types for convenience (types are erased at runtime, safe for tree-shaking)
export type {
  RagieDocumentStatusUpdatedEvent,
  RagieDocumentDeletedEvent,
  RagieEntityExtractedEvent,
  RagieConnectionSyncStartedEvent,
  RagieConnectionSyncProgressEvent,
  RagieConnectionSyncFinishedEvent,
  RagieConnectionLimitExceededEvent,
  RagiePartitionLimitExceededEvent,
} from "./schemas.js";

// ============================================================================
// Ragie Provider Implementation
// ============================================================================

/**
 * Options for creating a Ragie webhook
 */
export interface RagieOptions {
  /**
   * Webhook secret for signature verification
   * This should match the signing secret provided in your Ragie webhook settings
   * @see https://docs.ragie.ai/docs/webhooks#validating-signature
   */
  secret?: string;
}

/**
 * Create a Ragie provider for webhook handling
 * Implements signature verification using HMAC-SHA256
 *
 * Ragie webhooks use an envelope structure where:
 * - Event type is in body.type
 * - Actual payload is in body.payload
 * - Nonce for idempotency is in body.nonce
 *
 * @see https://docs.ragie.ai/docs/webhooks
 */
function createRagieProvider(options?: RagieOptions): Provider<"ragie"> {
  return {
    name: "ragie",
    secret: options?.secret,

    /**
     * Extract the event type from the body
     * Ragie sends the event type in body.type (not in headers)
     */
    getEventType(_headers: Headers, body?: unknown): string | undefined {
      if (body && typeof body === "object" && "type" in body) {
        return (body as { type: string }).type;
      }
      return undefined;
    },

    /**
     * Extract delivery ID
     * Ragie doesn't send a delivery ID header.
     * For idempotency, use the `nonce` from the body envelope (exposed as `payload.nonce`).
     */
    getDeliveryId(_headers: Headers): string | undefined {
      return undefined;
    },

    /**
     * Extract the actual payload from the envelope structure
     * Ragie wraps the payload in { type, payload, nonce }.
     * The SDK unwraps `payload` and attaches `nonce` onto the payload as `payload.nonce`.
     */
    getPayload(body: unknown): unknown {
      if (body && typeof body === "object" && "payload" in body) {
        const payload = (body as { payload: unknown }).payload;
        const nonce =
          "nonce" in body &&
          typeof (body as { nonce: unknown }).nonce === "string"
            ? (body as { nonce: string }).nonce
            : undefined;

        // For convenience, attach nonce onto the unwrapped payload when possible.
        // This enables idempotency using `payload.nonce` while still validating the inner payload.
        if (payload && typeof payload === "object" && nonce) {
          return { ...(payload as Record<string, unknown>), nonce };
        }

        return payload;
      }
      return body;
    },

    /**
     * Verify the webhook signature using HMAC-SHA256
     * Ragie sends the signature in the X-Signature header
     * @see https://docs.ragie.ai/docs/webhooks#validating-signature
     */
    verify(
      rawBody: string | Buffer,
      headers: Headers,
      secret: string,
    ): boolean {
      const signature = headers["x-signature"];

      if (!signature) {
        return false;
      }

      // Compute HMAC-SHA256
      const body =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
      const hmac = createHmac("sha256", secret);
      hmac.update(body, "utf-8");
      const computedSignature = hmac.digest("hex");

      // Constant-time comparison to prevent timing attacks
      try {
        const expectedBuffer = Buffer.from(signature, "hex");
        const computedBuffer = Buffer.from(computedSignature, "hex");

        if (expectedBuffer.length !== computedBuffer.length) {
          return false;
        }

        return timingSafeEqual(expectedBuffer, computedBuffer);
      } catch {
        return false;
      }
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a Ragie webhook builder
 *
 * Supports the following events (import from "@better-webhook/ragie/events"):
 * - `document_status_updated` - Document enters indexed, ready, or failed state
 * - `document_deleted` - Document is deleted
 * - `entity_extracted` - Entity extraction completes
 * - `connection_sync_started` - Connection sync begins
 * - `connection_sync_progress` - Periodic sync progress updates
 * - `connection_sync_finished` - Connection sync completes
 * - `connection_limit_exceeded` - Connection page limit exceeded
 * - `partition_limit_exceeded` - Partition document limit exceeded
 *
 * @see https://docs.ragie.ai/docs/webhooks
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { document_status_updated, connection_sync_started } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET })
 *   .event(document_status_updated, async (payload) => {
 *     console.log(`Document ${payload.document_id} is now ${payload.status}`);
 *   })
 *   .event(connection_sync_started, async (payload) => {
 *     console.log(`Sync ${payload.sync_id} started for connection ${payload.connection_id}`);
 *   });
 * ```
 */
export function ragie(options?: RagieOptions): WebhookBuilder<"ragie"> {
  const provider = createRagieProvider(options);
  return new WebhookBuilder(provider);
}
