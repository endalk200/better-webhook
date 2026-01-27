import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  ragie,
  type RagieDocumentStatusUpdatedEvent,
  type RagieDocumentDeletedEvent,
  type RagieEntityExtractedEvent,
  type RagieConnectionSyncStartedEvent,
  type RagieConnectionSyncProgressEvent,
  type RagieConnectionSyncFinishedEvent,
  type RagieConnectionLimitExceededEvent,
} from "./index.js";
import {
  document_status_updated,
  document_deleted,
  entity_extracted,
  connection_sync_started,
  connection_sync_progress,
  connection_sync_finished,
  connection_limit_exceeded,
  partition_limit_exceeded,
} from "./events.js";
import {
  RagieDocumentStatusUpdatedEventSchema,
  RagieDocumentDeletedEventSchema,
  RagieEntityExtractedEventSchema,
  RagieConnectionSyncStartedEventSchema,
  RagieConnectionSyncProgressEventSchema,
  RagieConnectionSyncFinishedEventSchema,
  RagieConnectionLimitExceededEventSchema,
} from "./schemas.js";

// ============================================================================
// Test Fixtures - Payloads (inside envelope)
// ============================================================================

const validDocumentStatusUpdatedPayload: RagieDocumentStatusUpdatedEvent = {
  document_id: "aa9a87d5-fbfa-4b48-8db3-b88a0d5826d4",
  status: "ready",
  partition: "default",
  metadata: { key: "value" },
  external_id: "ext_123",
  name: "Test Document.pdf",
  connection_id: null,
  sync_id: null,
  error: null,
};

const validDocumentDeletedPayload: RagieDocumentDeletedEvent = {
  document_id: "f16812e2-9159-4de7-be62-5c19010582a5",
  partition: "default",
  metadata: { key: "value" },
  external_id: "ext_123",
  name: "Test Document.pdf",
  connection_id: null,
  sync_id: null,
};

const validEntityExtractedPayload: RagieEntityExtractedEvent = {
  entity_id: "be49098d-7b17-462c-bfb7-379e985882f1",
  document_id: "7aa8841d-1d4a-41d0-8549-1c42db1ace42",
  instruction_id: "645ed2a7-67fb-4637-b12d-c4643d6d8706",
  document_metadata: { key: "value" },
  document_external_id: "ext_123",
  document_name: "Test Document.pdf",
  partition: "default",
  sync_id: null,
  data: { key: "value" },
};

const validConnectionSyncStartedPayload: RagieConnectionSyncStartedEvent = {
  connection_id: "622abd9c-a511-4a0b-827c-b56832b40c46",
  sync_id: "6638577d-b241-4d7b-b611-81668feed866",
  partition: "default",
  connection_metadata: { source: "google-drive", folder_id: "folder-123" },
  create_count: 4,
  update_content_count: 2,
  update_metadata_count: 1,
  delete_count: 1,
};

const validConnectionSyncProgressPayload: RagieConnectionSyncProgressEvent = {
  connection_id: "b6a2ff40-3919-4f4d-8c81-4288dcd030dc",
  sync_id: "559dda4b-a250-49ca-a5f3-f4fb7deb0b04",
  partition: "default",
  connection_metadata: { source: "google-drive", folder_id: "folder-123" },
  create_count: 4,
  created_count: 2,
  update_content_count: 2,
  updated_content_count: 1,
  update_metadata_count: 1,
  updated_metadata_count: 0,
  delete_count: 1,
  deleted_count: 1,
  errored_count: 0,
};

const validConnectionSyncFinishedPayload: RagieConnectionSyncFinishedEvent = {
  connection_id: "1936bf39-f0c8-43de-b1cc-e7c60c3493b1",
  sync_id: "9f3ee773-225f-4c3f-8f40-98d80d48ca80",
  partition: "default",
  connection_metadata: { source: "google-drive", folder_id: "folder-123" },
};

const validConnectionLimitExceededPayload: RagieConnectionLimitExceededEvent = {
  connection_id: "fb283324-d6ad-4803-ba4b-3cb32e46e5ae",
  partition: "default",
  connection_metadata: { source: "notion", workspace_id: "workspace-abc123" },
  limit_type: "page_limit",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a Ragie envelope structure
 */
function createEnvelope(
  type: string,
  payload: unknown,
  nonce: string = "unique-nonce-123",
) {
  return { type, payload, nonce };
}

/**
 * Create HMAC-SHA256 signature
 */
function createSignature(body: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(body, "utf-8");
  return hmac.digest("hex");
}

// ============================================================================
// Schema Tests
// ============================================================================

describe("Ragie Schemas", () => {
  describe("RagieDocumentStatusUpdatedEventSchema", () => {
    it("should validate a valid document status updated event", () => {
      const result = RagieDocumentStatusUpdatedEventSchema.safeParse(
        validDocumentStatusUpdatedPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid document status", () => {
      const result = RagieDocumentStatusUpdatedEventSchema.safeParse({
        ...validDocumentStatusUpdatedPayload,
        status: "invalid-status",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
      const result = RagieDocumentStatusUpdatedEventSchema.safeParse({
        document_id: "test",
      });
      expect(result.success).toBe(false);
    });

    it("should accept nullable fields as null", () => {
      const result = RagieDocumentStatusUpdatedEventSchema.safeParse({
        ...validDocumentStatusUpdatedPayload,
        metadata: null,
        external_id: null,
        connection_id: null,
        sync_id: null,
        error: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("RagieDocumentDeletedEventSchema", () => {
    it("should validate a valid document deleted event", () => {
      const result = RagieDocumentDeletedEventSchema.safeParse(
        validDocumentDeletedPayload,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("RagieEntityExtractedEventSchema", () => {
    it("should validate a valid entity extracted event", () => {
      const result = RagieEntityExtractedEventSchema.safeParse(
        validEntityExtractedPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should require entity_id field", () => {
      const { entity_id, ...rest } = validEntityExtractedPayload;
      const result = RagieEntityExtractedEventSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("RagieConnectionSyncStartedEventSchema", () => {
    it("should validate a valid connection sync started event", () => {
      const result = RagieConnectionSyncStartedEventSchema.safeParse(
        validConnectionSyncStartedPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should accept optional connection_metadata", () => {
      const { connection_metadata, ...rest } =
        validConnectionSyncStartedPayload;
      const result = RagieConnectionSyncStartedEventSchema.safeParse(rest);
      expect(result.success).toBe(true);
    });
  });

  describe("RagieConnectionSyncProgressEventSchema", () => {
    it("should validate a valid connection sync progress event", () => {
      const result = RagieConnectionSyncProgressEventSchema.safeParse(
        validConnectionSyncProgressPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should require errored_count field", () => {
      const { errored_count, ...rest } = validConnectionSyncProgressPayload;
      const result = RagieConnectionSyncProgressEventSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("RagieConnectionSyncFinishedEventSchema", () => {
    it("should validate a valid connection sync finished event", () => {
      const result = RagieConnectionSyncFinishedEventSchema.safeParse(
        validConnectionSyncFinishedPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should not require count fields (minimal payload)", () => {
      const result = RagieConnectionSyncFinishedEventSchema.safeParse({
        connection_id: "conn-123",
        sync_id: "sync-456",
        partition: "default",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("RagieConnectionLimitExceededEventSchema", () => {
    it("should validate a valid connection limit exceeded event", () => {
      const result = RagieConnectionLimitExceededEventSchema.safeParse(
        validConnectionLimitExceededPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should require limit_type field", () => {
      const { limit_type, ...rest } = validConnectionLimitExceededPayload;
      const result = RagieConnectionLimitExceededEventSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// ragie() Factory Tests
// ============================================================================

describe("ragie()", () => {
  beforeEach(() => {
    delete process.env.RAGIE_WEBHOOK_SECRET;
    delete process.env.WEBHOOK_SECRET;
  });

  it("should create a webhook builder", () => {
    const webhook = ragie();
    expect(webhook).toBeDefined();
    expect(webhook.getProvider().name).toBe("ragie");
  });

  it("should accept a secret option", () => {
    const webhook = ragie({ secret: "my-secret" });
    expect(webhook.getProvider().secret).toBe("my-secret");
  });

  describe("event handlers with envelope structure", () => {
    it("should handle document_status_updated events", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(document_status_updated, handler);

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: "aa9a87d5-fbfa-4b48-8db3-b88a0d5826d4",
          status: "ready",
          name: "Test Document.pdf",
        }),
        expect.objectContaining({
          eventType: "document_status_updated",
          provider: "ragie",
        }),
      );
    });

    it("should handle document_deleted events", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_deleted",
        validDocumentDeletedPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(document_deleted, handler);

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: "f16812e2-9159-4de7-be62-5c19010582a5",
          name: "Test Document.pdf",
        }),
        expect.objectContaining({
          eventType: "document_deleted",
          provider: "ragie",
        }),
      );
    });

    it("should handle entity_extracted events", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "entity_extracted",
        validEntityExtractedPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(entity_extracted, handler);

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_id: "be49098d-7b17-462c-bfb7-379e985882f1",
          document_id: "7aa8841d-1d4a-41d0-8549-1c42db1ace42",
          instruction_id: "645ed2a7-67fb-4637-b12d-c4643d6d8706",
        }),
        expect.objectContaining({
          eventType: "entity_extracted",
          provider: "ragie",
        }),
      );
    });

    it("should handle connection_sync_started events", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "connection_sync_started",
        validConnectionSyncStartedPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(connection_sync_started, handler);

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: "622abd9c-a511-4a0b-827c-b56832b40c46",
          sync_id: "6638577d-b241-4d7b-b611-81668feed866",
          create_count: 4,
          update_content_count: 2,
        }),
        expect.objectContaining({
          eventType: "connection_sync_started",
          provider: "ragie",
        }),
      );
    });

    it("should handle connection_sync_progress events", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "connection_sync_progress",
        validConnectionSyncProgressPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(
        connection_sync_progress,
        handler,
      );

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          create_count: 4,
          created_count: 2,
          errored_count: 0,
        }),
        expect.objectContaining({
          eventType: "connection_sync_progress",
          provider: "ragie",
        }),
      );
    });

    it("should handle connection_sync_finished events", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "connection_sync_finished",
        validConnectionSyncFinishedPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(
        connection_sync_finished,
        handler,
      );

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_id: "9f3ee773-225f-4c3f-8f40-98d80d48ca80",
        }),
        expect.objectContaining({
          eventType: "connection_sync_finished",
          provider: "ragie",
        }),
      );
    });

    it("should handle connection_limit_exceeded events", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "connection_limit_exceeded",
        validConnectionLimitExceededPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(
        connection_limit_exceeded,
        handler,
      );

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: "fb283324-d6ad-4803-ba4b-3cb32e46e5ae",
          limit_type: "page_limit",
        }),
        expect.objectContaining({
          eventType: "connection_limit_exceeded",
          provider: "ragie",
        }),
      );
    });
  });

  describe("signature verification", () => {
    it("should verify valid signatures", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);

      const webhook = ragie({ secret }).event(
        document_status_updated,
        () => {},
      );

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
    });

    it("should reject invalid signatures", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);

      const webhook = ragie({ secret }).event(
        document_status_updated,
        () => {},
      );

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": "invalid-signature",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
    });

    it("should reject missing signatures when secret is provided", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);

      const webhook = ragie({ secret }).event(
        document_status_updated,
        () => {},
      );

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
    });

    it("should fail when no secret is configured", async () => {
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);
      const handler = vi.fn();

      const webhook = ragie().event(document_status_updated, handler);

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
      expect(result.body?.error).toBe("Missing webhook secret");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("event type extraction from body", () => {
    it("should extract event type from body.type", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);
      const signature = createHmac("sha256", secret).update(body).digest("hex");
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(document_status_updated, handler);

      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": signature,
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(result.eventType).toBe("document_status_updated");
    });

    it("should not call handler for unregistered event types", async () => {
      const secret = "test-secret";
      // Create envelope for partition_limit_exceeded but register handler for document_status_updated
      const envelope = createEnvelope("partition_limit_exceeded", {
        partition: "default",
      });
      const body = JSON.stringify(envelope);
      const signature = createHmac("sha256", secret).update(body).digest("hex");
      const documentHandler = vi.fn();
      const partitionHandler = vi.fn();

      // Register handlers for both events
      const webhook = ragie({ secret })
        .event(document_status_updated, documentHandler)
        .event(partition_limit_exceeded, partitionHandler);

      // Send partition_limit_exceeded event
      const result = await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": signature,
        },
        rawBody: body,
      });

      // Should succeed and call only the partition handler
      expect(result.status).toBe(200);
      expect(partitionHandler).toHaveBeenCalled();
      expect(documentHandler).not.toHaveBeenCalled();
    });
  });

  describe("chaining", () => {
    it("should support chaining multiple events", async () => {
      const secret = "test-secret";
      const docHandler = vi.fn();
      const syncHandler = vi.fn();

      const webhook = ragie({ secret })
        .event(document_status_updated, docHandler)
        .event(connection_sync_started, syncHandler);

      // Test document event
      const docEnvelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const docBody = JSON.stringify(docEnvelope);
      await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(docBody, secret),
        },
        rawBody: docBody,
      });

      expect(docHandler).toHaveBeenCalled();
      expect(syncHandler).not.toHaveBeenCalled();

      // Reset handlers
      docHandler.mockClear();
      syncHandler.mockClear();

      // Test sync event
      const syncEnvelope = createEnvelope(
        "connection_sync_started",
        validConnectionSyncStartedPayload,
      );
      const syncBody = JSON.stringify(syncEnvelope);
      await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(syncBody, secret),
        },
        rawBody: syncBody,
      });

      expect(syncHandler).toHaveBeenCalled();
      expect(docHandler).not.toHaveBeenCalled();
    });

    it("should support error handlers", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);
      const onError = vi.fn();

      const webhook = ragie({ secret })
        .event(document_status_updated, () => {
          throw new Error("Test error");
        })
        .onError(onError);

      await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(onError).toHaveBeenCalled();
    });

    it("should support verification failed handlers", async () => {
      const secret = "test-secret";
      const envelope = createEnvelope(
        "document_status_updated",
        validDocumentStatusUpdatedPayload,
      );
      const body = JSON.stringify(envelope);
      const onVerificationFailed = vi.fn();

      const webhook = ragie({ secret })
        .event(document_status_updated, () => {})
        .onVerificationFailed(onVerificationFailed);

      await webhook.process({
        headers: {
          "content-type": "application/json",
          "x-signature": "invalid-signature",
        },
        rawBody: body,
      });

      expect(onVerificationFailed).toHaveBeenCalled();
    });
  });
});
