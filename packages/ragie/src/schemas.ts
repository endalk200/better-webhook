import { z } from "zod";

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
  nonce: z.string(),
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
  nonce: z.string(),
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
  nonce: z.string(),
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
  nonce: z.string(),
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
  nonce: z.string(),
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
  nonce: z.string(),
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
  nonce: z.string(),
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
  nonce: z.string(),
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
