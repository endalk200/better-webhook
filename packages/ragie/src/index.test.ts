import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  ragie,
  RagieDocumentStatusUpdatedEventSchema,
  RagieConnectionSyncStartedEventSchema,
  RagieConnectionSyncProgressEventSchema,
  RagieConnectionSyncFinishedEventSchema,
  type RagieDocumentStatusUpdatedEvent,
  type RagieConnectionSyncStartedEvent,
  type RagieConnectionSyncProgressEvent,
  type RagieConnectionSyncFinishedEvent,
} from "./index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const validDocumentStatusUpdatedPayload: RagieDocumentStatusUpdatedEvent = {
  nonce: "unique-nonce-123",
  document_id: "doc-123",
  external_id: "ext-456",
  status: "ready",
  sync_id: "sync-789",
  partition: "partition-1",
};

const validConnectionSyncStartedPayload: RagieConnectionSyncStartedEvent = {
  nonce: "unique-nonce-456",
  connection_id: "conn-123",
  sync_id: "sync-456",
  partition: "partition-1",
  connection_metadata: {
    source: "google-drive",
    folder_id: "folder-123",
  },
};

const validConnectionSyncProgressPayload: RagieConnectionSyncProgressEvent = {
  nonce: "unique-nonce-789",
  connection_id: "conn-123",
  sync_id: "sync-456",
  partition: "partition-1",
  connection_metadata: {
    source: "google-drive",
    folder_id: "folder-123",
  },
  total_creates_count: 100,
  created_count: 10,
  total_contents_updates_count: 50,
  contents_updated_count: 5,
  total_metadata_updates_count: 25,
  metadata_updated_count: 2,
  total_deletes_count: 10,
  deleted_count: 1,
};

const validConnectionSyncFinishedPayload: RagieConnectionSyncFinishedEvent = {
  nonce: "unique-nonce-012",
  connection_id: "conn-123",
  sync_id: "sync-456",
  partition: "partition-1",
  connection_metadata: {
    source: "google-drive",
    folder_id: "folder-123",
  },
  total_creates_count: 100,
  created_count: 0,
  total_contents_updates_count: 50,
  contents_updated_count: 0,
  total_metadata_updates_count: 25,
  metadata_updated_count: 0,
  total_deletes_count: 10,
  deleted_count: 0,
};

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
        nonce: "test",
      });
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
      const payload = {
        ...validConnectionSyncStartedPayload,
        connection_metadata: undefined,
      };
      const result = RagieConnectionSyncStartedEventSchema.safeParse(payload);
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

    it("should require numeric count fields", () => {
      const result = RagieConnectionSyncProgressEventSchema.safeParse({
        ...validConnectionSyncProgressPayload,
        total_creates_count: "not-a-number",
      });
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

  describe("event handlers", () => {
    it("should handle document_status_updated events", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(
        "document_status_updated",
        handler,
      );

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
          "x-ragie-delivery": "delivery-123",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: "doc-123",
          status: "ready",
          nonce: "unique-nonce-123",
        }),
        expect.objectContaining({
          eventType: "document_status_updated",
          provider: "ragie",
        }),
      );
    });

    it("should handle connection_sync_started events", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validConnectionSyncStartedPayload);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(
        "connection_sync_started",
        handler,
      );

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "connection_sync_started",
          "x-ragie-delivery": "delivery-456",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: "conn-123",
          sync_id: "sync-456",
        }),
        expect.objectContaining({
          eventType: "connection_sync_started",
          provider: "ragie",
        }),
      );
    });

    it("should handle connection_sync_progress events", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validConnectionSyncProgressPayload);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(
        "connection_sync_progress",
        handler,
      );

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "connection_sync_progress",
          "x-ragie-delivery": "delivery-789",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          total_creates_count: 100,
          created_count: 10,
        }),
        expect.objectContaining({
          eventType: "connection_sync_progress",
          provider: "ragie",
        }),
      );
    });

    it("should handle connection_sync_finished events", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validConnectionSyncFinishedPayload);
      const handler = vi.fn();

      const webhook = ragie({ secret }).event(
        "connection_sync_finished",
        handler,
      );

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "connection_sync_finished",
          "x-ragie-delivery": "delivery-012",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_id: "sync-456",
          total_creates_count: 100,
        }),
        expect.objectContaining({
          eventType: "connection_sync_finished",
          provider: "ragie",
        }),
      );
    });
  });

  describe("signature verification", () => {
    it("should verify valid signatures", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);

      const webhook = ragie({ secret }).event(
        "document_status_updated",
        () => {},
      );

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
    });

    it("should reject invalid signatures", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);

      const webhook = ragie({ secret }).event(
        "document_status_updated",
        () => {},
      );

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
          "x-signature": "invalid-signature",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
    });

    it("should reject missing signatures", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);

      const webhook = ragie({ secret }).event(
        "document_status_updated",
        () => {},
      );

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
    });

    it("should work without secret when not required", async () => {
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);
      const handler = vi.fn();

      const webhook = ragie().event("document_status_updated", handler);

      const result = await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("chaining", () => {
    it("should support chaining multiple events", async () => {
      const secret = "test-secret";
      const docHandler = vi.fn();
      const syncHandler = vi.fn();

      const webhook = ragie({ secret })
        .event("document_status_updated", docHandler)
        .event("connection_sync_started", syncHandler);

      // Test document event
      const docBody = JSON.stringify(validDocumentStatusUpdatedPayload);
      await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
          "x-signature": createSignature(docBody, secret),
        },
        rawBody: docBody,
      });

      expect(docHandler).toHaveBeenCalled();
      expect(syncHandler).not.toHaveBeenCalled();

      // Test sync event
      const syncBody = JSON.stringify(validConnectionSyncStartedPayload);
      await webhook.process({
        headers: {
          "x-ragie-event": "connection_sync_started",
          "x-signature": createSignature(syncBody, secret),
        },
        rawBody: syncBody,
      });

      expect(syncHandler).toHaveBeenCalled();
    });

    it("should support error handlers", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);
      const onError = vi.fn();

      const webhook = ragie({ secret })
        .event("document_status_updated", () => {
          throw new Error("Test error");
        })
        .onError(onError);

      await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(onError).toHaveBeenCalled();
    });

    it("should support verification failed handlers", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);
      const onVerificationFailed = vi.fn();

      const webhook = ragie({ secret })
        .event("document_status_updated", () => {})
        .onVerificationFailed(onVerificationFailed);

      await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
          "x-signature": "invalid-signature",
        },
        rawBody: body,
      });

      expect(onVerificationFailed).toHaveBeenCalled();
    });
  });

  describe("idempotency", () => {
    it("should expose nonce for idempotency checks", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validDocumentStatusUpdatedPayload);
      let receivedNonce: string | undefined;

      const webhook = ragie({ secret }).event(
        "document_status_updated",
        (payload) => {
          receivedNonce = payload.nonce;
        },
      );

      await webhook.process({
        headers: {
          "x-ragie-event": "document_status_updated",
          "x-signature": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(receivedNonce).toBe("unique-nonce-123");
    });
  });
});

