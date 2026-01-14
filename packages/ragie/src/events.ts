import { defineEvent } from "@better-webhook/core";
import {
  RagieDocumentStatusUpdatedEventSchema,
  RagieDocumentDeletedEventSchema,
  RagieEntityExtractedEventSchema,
  RagieConnectionSyncStartedEventSchema,
  RagieConnectionSyncProgressEventSchema,
  RagieConnectionSyncFinishedEventSchema,
  RagieConnectionLimitExceededEventSchema,
  RagiePartitionLimitExceededEventSchema,
} from "./schemas.js";

/**
 * Ragie provider brand for type-level constraints
 */
export type RagieProvider = "ragie";

/**
 * Document status updated event - triggered when a document enters
 * indexed, keyword_indexed, ready, or failed state.
 * @see https://docs.ragie.ai/docs/webhooks#document_status_updated
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { document_status_updated } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(document_status_updated, async (payload) => {
 *     console.log(`Document ${payload.document_id} is now ${payload.status}`);
 *   });
 * ```
 */
export const document_status_updated = defineEvent({
  name: "document_status_updated",
  schema: RagieDocumentStatusUpdatedEventSchema,
  provider: "ragie" as const,
});

/**
 * Document deleted event - triggered when a document is deleted.
 * @see https://docs.ragie.ai/docs/webhooks#document_deleted
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { document_deleted } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(document_deleted, async (payload) => {
 *     console.log(`Document ${payload.document_id} was deleted`);
 *   });
 * ```
 */
export const document_deleted = defineEvent({
  name: "document_deleted",
  schema: RagieDocumentDeletedEventSchema,
  provider: "ragie" as const,
});

/**
 * Entity extracted event - triggered when entity extraction completes for a document.
 * @see https://docs.ragie.ai/docs/webhooks#entity_extracted
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { entity_extracted } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(entity_extracted, async (payload) => {
 *     console.log(`Entity ${payload.entity_id} extracted from ${payload.document_name}`);
 *   });
 * ```
 */
export const entity_extracted = defineEvent({
  name: "entity_extracted",
  schema: RagieEntityExtractedEventSchema,
  provider: "ragie" as const,
});

/**
 * Connection sync started event - triggered when a connection sync begins.
 * @see https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { connection_sync_started } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(connection_sync_started, async (payload) => {
 *     console.log(`Sync ${payload.sync_id} started for connection ${payload.connection_id}`);
 *   });
 * ```
 */
export const connection_sync_started = defineEvent({
  name: "connection_sync_started",
  schema: RagieConnectionSyncStartedEventSchema,
  provider: "ragie" as const,
});

/**
 * Connection sync progress event - triggered periodically during a sync to report progress.
 * @see https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { connection_sync_progress } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(connection_sync_progress, async (payload) => {
 *     console.log(`Sync progress: ${payload.created_count}/${payload.create_count} created`);
 *   });
 * ```
 */
export const connection_sync_progress = defineEvent({
  name: "connection_sync_progress",
  schema: RagieConnectionSyncProgressEventSchema,
  provider: "ragie" as const,
});

/**
 * Connection sync finished event - triggered when a connection sync completes.
 * @see https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { connection_sync_finished } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(connection_sync_finished, async (payload) => {
 *     console.log(`Sync ${payload.sync_id} finished for connection ${payload.connection_id}`);
 *   });
 * ```
 */
export const connection_sync_finished = defineEvent({
  name: "connection_sync_finished",
  schema: RagieConnectionSyncFinishedEventSchema,
  provider: "ragie" as const,
});

/**
 * Connection limit exceeded event - triggered when a connection exceeds its page limit.
 * @see https://docs.ragie.ai/docs/webhooks#connection_limit_exceeded
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { connection_limit_exceeded } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(connection_limit_exceeded, async (payload) => {
 *     console.log(`Connection ${payload.connection_id} exceeded ${payload.limit_type} limit`);
 *   });
 * ```
 */
export const connection_limit_exceeded = defineEvent({
  name: "connection_limit_exceeded",
  schema: RagieConnectionLimitExceededEventSchema,
  provider: "ragie" as const,
});

/**
 * Partition limit exceeded event - triggered when a partition exceeds its document limit.
 * @see https://docs.ragie.ai/docs/webhooks#partition_limit_exceeded
 *
 * @example
 * ```ts
 * import { ragie } from "@better-webhook/ragie";
 * import { partition_limit_exceeded } from "@better-webhook/ragie/events";
 *
 * const webhook = ragie()
 *   .event(partition_limit_exceeded, async (payload) => {
 *     console.log(`Partition ${payload.partition} exceeded document limit`);
 *   });
 * ```
 */
export const partition_limit_exceeded = defineEvent({
  name: "partition_limit_exceeded",
  schema: RagiePartitionLimitExceededEventSchema,
  provider: "ragie" as const,
});

// Re-export types for convenience
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
