import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createWebhook,
  type Provider,
  type Headers,
  type WebhookBuilder,
} from "@better-webhook/core";
import { z, type ZodSchema } from "zod";

// ============================================================================
// Ragie Webhook Documentation
// @see https://docs.ragie.ai/docs/webhooks
// @see https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks
//
// Ragie webhooks use an envelope structure:
// {
//   "type": "event_type",
//   "payload": { ...actual event data... },
//   "nonce": "unique-id-for-idempotency"
// }
// ============================================================================

// ============================================================================
// Document Status Updated Event
// @see https://docs.ragie.ai/docs/webhooks#document_status_updated
// ============================================================================

/**
 * Document status updated event schema
 * Triggered when a document enters indexed, keyword_indexed, ready, or failed state
 */
export const RagieDocumentStatusUpdatedEventSchema = z.object({
  /** The unique identifier for the document */
  document_id: z.string(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
  /** Current status of the document */
  status: z.enum(["indexed", "keyword_indexed", "ready", "failed"]),
  /** Partition key for the document */
  partition: z.string(),
  /** User-defined metadata for the document */
  metadata: z.record(z.string(), z.unknown()).nullable(),
  /** External ID if provided when creating the document */
  external_id: z.string().nullable(),
  /** Name of the document */
  name: z.string(),
  /** Connection ID if the document was created via a connection */
  connection_id: z.string().nullable(),
  /** Sync ID if the document was created as part of a sync */
  sync_id: z.string().nullable(),
  /** Error message if status is 'failed' */
  error: z.string().nullable(),
});

// ============================================================================
// Document Deleted Event
// @see https://docs.ragie.ai/docs/webhooks#document_deleted
// ============================================================================

/**
 * Document deleted event schema
 * Triggered when a document is deleted
 */
export const RagieDocumentDeletedEventSchema = z.object({
  /** The unique identifier for the deleted document */
  document_id: z.string(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
  /** Partition key for the document */
  partition: z.string(),
  /** User-defined metadata for the document */
  metadata: z.record(z.string(), z.unknown()).nullable(),
  /** External ID if provided when creating the document */
  external_id: z.string().nullable(),
  /** Name of the document */
  name: z.string(),
  /** Connection ID if the document was created via a connection */
  connection_id: z.string().nullable(),
  /** Sync ID if the document was created as part of a sync */
  sync_id: z.string().nullable(),
});

// ============================================================================
// Entity Extracted Event
// @see https://docs.ragie.ai/docs/webhooks#entity_extracted
// ============================================================================

/**
 * Entity extracted event schema
 * Triggered when entity extraction completes for a document
 */
export const RagieEntityExtractedEventSchema = z.object({
  /** The unique identifier for the extracted entity */
  entity_id: z.string(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
  /** The unique identifier for the source document */
  document_id: z.string(),
  /** The instruction ID used for entity extraction */
  instruction_id: z.string(),
  /** User-defined metadata from the source document */
  document_metadata: z.record(z.string(), z.unknown()),
  /** External ID of the source document */
  document_external_id: z.string(),
  /** Name of the source document */
  document_name: z.string(),
  /** Partition key for the document */
  partition: z.string(),
  /** Sync ID if the document was created as part of a sync */
  sync_id: z.string().nullable(),
  /** The extracted entity data */
  data: z.record(z.string(), z.unknown()),
});

// ============================================================================
// Connection Sync Started Event
// @see https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks
// ============================================================================

/**
 * Connection sync started event schema
 * Triggered when a connection sync begins
 */
export const RagieConnectionSyncStartedEventSchema = z.object({
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
  /** The unique identifier for this sync */
  sync_id: z.string(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
  /** Number of documents to be created */
  create_count: z.number(),
  /** Number of documents with content updates */
  update_content_count: z.number(),
  /** Number of documents with metadata updates */
  update_metadata_count: z.number(),
  /** Number of documents to be deleted */
  delete_count: z.number(),
});

// ============================================================================
// Connection Sync Progress Event
// @see https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks
// ============================================================================

/**
 * Connection sync progress event schema
 * Triggered periodically during a sync to report progress
 */
export const RagieConnectionSyncProgressEventSchema = z.object({
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
  /** The unique identifier for this sync */
  sync_id: z.string(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
  /** Total number of documents to be created */
  create_count: z.number(),
  /** Number of documents created so far */
  created_count: z.number(),
  /** Total number of documents with content updates */
  update_content_count: z.number(),
  /** Number of content updates completed so far */
  updated_content_count: z.number(),
  /** Total number of documents with metadata updates */
  update_metadata_count: z.number(),
  /** Number of metadata updates completed so far */
  updated_metadata_count: z.number(),
  /** Total number of documents to be deleted */
  delete_count: z.number(),
  /** Number of documents deleted so far */
  deleted_count: z.number(),
  /** Number of documents that encountered errors */
  errored_count: z.number(),
});

// ============================================================================
// Connection Sync Finished Event
// @see https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks
// ============================================================================

/**
 * Connection sync finished event schema
 * Triggered when a connection sync completes
 */
export const RagieConnectionSyncFinishedEventSchema = z.object({
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
  /** The unique identifier for this sync */
  sync_id: z.string(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Connection Limit Exceeded Event
// @see https://docs.ragie.ai/docs/webhooks#connection_limit_exceeded
// ============================================================================

/**
 * Connection limit exceeded event schema
 * Triggered when a connection exceeds its page limit
 */
export const RagieConnectionLimitExceededEventSchema = z.object({
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
  /** The type of limit that was exceeded (e.g., "page_limit") */
  limit_type: z.string(),
});

// ============================================================================
// Partition Limit Exceeded Event
// @see https://docs.ragie.ai/docs/webhooks#partition_limit_exceeded
// ============================================================================

/**
 * Partition limit exceeded event schema
 * Triggered when a partition exceeds its document limit
 */
export const RagiePartitionLimitExceededEventSchema = z.object({
  /** Partition key that exceeded the limit */
  partition: z.string(),
  /** The type of limit that was exceeded (if provided) */
  limit_type: z.string().optional(),
  /** Unique nonce for idempotency (from the webhook envelope) */
  nonce: z.string().optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type RagieDocumentStatusUpdatedEvent = z.infer<
  typeof RagieDocumentStatusUpdatedEventSchema
>;
export type RagieDocumentDeletedEvent = z.infer<
  typeof RagieDocumentDeletedEventSchema
>;
export type RagieEntityExtractedEvent = z.infer<
  typeof RagieEntityExtractedEventSchema
>;
export type RagieConnectionSyncStartedEvent = z.infer<
  typeof RagieConnectionSyncStartedEventSchema
>;
export type RagieConnectionSyncProgressEvent = z.infer<
  typeof RagieConnectionSyncProgressEventSchema
>;
export type RagieConnectionSyncFinishedEvent = z.infer<
  typeof RagieConnectionSyncFinishedEventSchema
>;
export type RagieConnectionLimitExceededEvent = z.infer<
  typeof RagieConnectionLimitExceededEventSchema
>;
export type RagiePartitionLimitExceededEvent = z.infer<
  typeof RagiePartitionLimitExceededEventSchema
>;

// ============================================================================
// Ragie Event Map
// ============================================================================

/**
 * Map of Ragie event types to their schemas
 * @see https://docs.ragie.ai/docs/webhooks
 */
const RagieSchemas = {
  /** Document status updated - document enters indexed, keyword_indexed, ready, or failed state */
  document_status_updated: RagieDocumentStatusUpdatedEventSchema,
  /** Document deleted - document is removed */
  document_deleted: RagieDocumentDeletedEventSchema,
  /** Entity extracted - entity extraction completes */
  entity_extracted: RagieEntityExtractedEventSchema,
  /** Connection sync started - sync begins */
  connection_sync_started: RagieConnectionSyncStartedEventSchema,
  /** Connection sync progress - periodic progress updates */
  connection_sync_progress: RagieConnectionSyncProgressEventSchema,
  /** Connection sync finished - sync completes */
  connection_sync_finished: RagieConnectionSyncFinishedEventSchema,
  /** Connection limit exceeded - connection page limit exceeded */
  connection_limit_exceeded: RagieConnectionLimitExceededEventSchema,
  /** Partition limit exceeded - partition document limit exceeded */
  partition_limit_exceeded: RagiePartitionLimitExceededEventSchema,
} as const;

type RagieEventMap = typeof RagieSchemas;

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
function createRagieProvider(options?: RagieOptions): Provider<RagieEventMap> {
  return {
    name: "ragie",
    schemas: RagieSchemas,
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
          "nonce" in body && typeof (body as { nonce: unknown }).nonce === "string"
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
 * Supports the following events:
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
 * const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET })
 *   .event('document_status_updated', async (payload) => {
 *     console.log(`Document ${payload.document_id} is now ${payload.status}`);
 *   })
 *   .event('connection_sync_started', async (payload) => {
 *     console.log(`Sync ${payload.sync_id} started for connection ${payload.connection_id}`);
 *   })
 *   .event('connection_sync_progress', async (payload) => {
 *     console.log(`Sync progress: ${payload.created_count}/${payload.create_count} created`);
 *   })
 *   .event('connection_sync_finished', async (payload) => {
 *     console.log(`Sync ${payload.sync_id} finished`);
 *   });
 * ```
 */
export function ragie(options?: RagieOptions): WebhookBuilder<RagieEventMap> {
  const provider = createRagieProvider(options);
  return createWebhook(provider);
}

// Re-export schemas for advanced use cases
export { RagieSchemas };
