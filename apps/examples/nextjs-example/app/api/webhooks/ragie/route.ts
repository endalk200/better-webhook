import { ragie } from "@better-webhook/ragie";
import {
  document_status_updated,
  document_deleted,
  entity_extracted,
  connection_sync_started,
  connection_sync_progress,
  connection_sync_finished,
  connection_limit_exceeded,
  partition_limit_exceeded,
} from "@better-webhook/ragie/events";
import { toNextJS } from "@better-webhook/nextjs";

// Create a Ragie webhook handler
const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET })
  .event(document_status_updated, async (payload, context) => {
    console.log("📄 Document status updated!");
    console.log(`   Received at: ${context.receivedAt.toISOString()}`);
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Status: ${payload.status}`);
    console.log(`   Partition: ${payload.partition || "default"}`);
  })
  .event(connection_sync_started, async (payload, context) => {
    console.log("🚀 Connection sync started!");
    console.log(`   Connection ID: ${payload.connection_id}`);
    console.log(`   Sync ID: ${payload.sync_id}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event(connection_sync_progress, async (payload, context) => {
    console.log("⏳ Connection sync progress!");
    console.log(`   Connection ID: ${payload.connection_id}`);
    console.log(`   Sync ID: ${payload.sync_id}`);
    console.log(`   Creates: ${payload.created_count}/${payload.create_count}`);
    console.log(
      `   Content updates: ${payload.updated_content_count}/${payload.update_content_count}`,
    );
    console.log(
      `   Metadata updates: ${payload.updated_metadata_count}/${payload.update_metadata_count}`,
    );
    console.log(`   Deletes: ${payload.deleted_count}/${payload.delete_count}`);
    console.log(`   Errors: ${payload.errored_count}`);
  })
  .event(connection_sync_finished, async (payload, context) => {
    console.log("✅ Connection sync finished!");
    console.log(`   Connection ID: ${payload.connection_id}`);
    console.log(`   Sync ID: ${payload.sync_id}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event(entity_extracted, async (payload, context) => {
    console.log("🔍 Entity extraction completed!");
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Partition: ${payload.partition || "default"}`);
  })
  .event(document_deleted, async (payload, context) => {
    console.log("🗑️ Document deleted!");
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event(connection_limit_exceeded, async (payload, context) => {
    console.log("⚠️ Connection limit exceeded!");
    console.log(`   Connection ID: ${payload.connection_id}`);
    console.log(`   Partition: ${payload.partition}`);
    console.log(`   Limit type: ${payload.limit_type}`);
  })
  .event(partition_limit_exceeded, async (payload, context) => {
    console.log("⚠️ Partition limit exceeded!");
    console.log(`   Partition: ${payload.partition}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Ragie webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason, headers) => {
    console.error("🔐 Verification failed:", reason);
    console.log("Headers: ", headers);
    console.log("Received signature header: ", headers["x-signature"]);
  });

// Export the POST handler
export const POST = toNextJS(webhook, {
  secret: process.env.RAGIE_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log(`✅ Successfully processed Ragie ${eventType} event`);
  },
});

// Optionally handle other methods
export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "/api/webhooks/ragie",
      supportedEvents: [
        "document_status_updated",
        "document_deleted",
        "entity_extracted",
        "connection_sync_started",
        "connection_sync_progress",
        "connection_sync_finished",
        "connection_limit_exceeded",
        "partition_limit_exceeded",
      ],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
