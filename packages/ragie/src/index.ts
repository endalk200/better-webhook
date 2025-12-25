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
// ============================================================================

// ============================================================================
// Shared Schemas
// ============================================================================

/**
 * Base webhook event schema
 * All Ragie webhook events include these common fields
 */
const BaseEventSchema = z.object({
  /**
   * A unique identifier for idempotency
   * Use this to prevent processing the same event multiple times
   */
  nonce: z.string(),
});

// ============================================================================
// Document Status Updated Event
// @see https://docs.ragie.ai/docs/webhooks#document_status_updated
// ============================================================================

/**
 * Document status updated event schema
 * Triggered when a document enters indexed, keyword_indexed, ready, or failed state
 */
export const RagieDocumentStatusUpdatedEventSchema = z.object({
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** The unique identifier for the document */
  document_id: z.string(),
  /** External ID if provided when creating the document */
  external_id: z.string().optional(),
  /** Current status of the document */
  status: z.enum(["indexed", "keyword_indexed", "ready", "failed"]),
  /** Sync ID if the document was created as part of a sync */
  sync_id: z.string().optional(),
  /** Partition key for the document */
  partition: z.string().optional(),
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
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** The unique identifier for the deleted document */
  document_id: z.string(),
  /** External ID if provided when creating the document */
  external_id: z.string().optional(),
  /** Partition key for the document */
  partition: z.string().optional(),
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
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** The unique identifier for the document */
  document_id: z.string(),
  /** External ID if provided when creating the document */
  external_id: z.string().optional(),
  /** Partition key for the document */
  partition: z.string().optional(),
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
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** The unique identifier for this sync */
  sync_id: z.string(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
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
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** The unique identifier for this sync */
  sync_id: z.string(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
  /** Total number of items created so far */
  total_creates_count: z.number(),
  /** Number of items created in this progress update */
  created_count: z.number(),
  /** Total number of content updates so far */
  total_contents_updates_count: z.number(),
  /** Number of content updates in this progress update */
  contents_updated_count: z.number(),
  /** Total number of metadata updates so far */
  total_metadata_updates_count: z.number(),
  /** Number of metadata updates in this progress update */
  metadata_updated_count: z.number(),
  /** Total number of items deleted so far */
  total_deletes_count: z.number(),
  /** Number of items deleted in this progress update */
  deleted_count: z.number(),
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
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** The unique identifier for this sync */
  sync_id: z.string(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
  /** Total number of items created during the sync */
  total_creates_count: z.number(),
  /** Number of items created in the final update */
  created_count: z.number(),
  /** Total number of content updates during the sync */
  total_contents_updates_count: z.number(),
  /** Number of content updates in the final update */
  contents_updated_count: z.number(),
  /** Total number of metadata updates during the sync */
  total_metadata_updates_count: z.number(),
  /** Number of metadata updates in the final update */
  metadata_updated_count: z.number(),
  /** Total number of items deleted during the sync */
  total_deletes_count: z.number(),
  /** Number of items deleted in the final update */
  deleted_count: z.number(),
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
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** The unique identifier for the connection */
  connection_id: z.string(),
  /** The unique identifier for the sync */
  sync_id: z.string(),
  /** Partition key for the sync */
  partition: z.string(),
  /** Additional metadata about the connection */
  connection_metadata: z.record(z.string(), z.unknown()).optional(),
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
  /** A unique identifier for idempotency */
  nonce: z.string(),
  /** Partition key that exceeded the limit */
  partition: z.string(),
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
 * @see https://docs.ragie.ai/docs/webhooks
 */
function createRagieProvider(options?: RagieOptions): Provider<RagieEventMap> {
  return {
    name: "ragie",
    schemas: RagieSchemas,
    secret: options?.secret,

    /**
     * Extract the event type from the X-Ragie-Event header
     * Ragie sends the event type in this custom header
     */
    getEventType(headers: Headers): string | undefined {
      return headers["x-ragie-event"];
    },

    /**
     * Extract the delivery ID from the X-Ragie-Delivery header
     * This uniquely identifies the webhook delivery
     */
    getDeliveryId(headers: Headers): string | undefined {
      return headers["x-ragie-delivery"];
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
 *     console.log(`Sync progress: ${payload.total_creates_count} created, ${payload.total_deletes_count} deleted`);
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

