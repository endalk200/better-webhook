import { createInMemoryReplayStore } from "@better-webhook/core";
import { toNextJS } from "@better-webhook/nextjs";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";
import { resend } from "@better-webhook/resend";
import {
  contact_created,
  domain_updated,
  email_bounced,
  email_delivered,
  email_received,
} from "@better-webhook/resend/events";

const replayStore = createInMemoryReplayStore();

const supportedEvents = [
  "email.delivered",
  "email.bounced",
  "email.received",
  "domain.updated",
  "contact.created",
];

function countTags(tags: Record<string, string> | undefined): number {
  if (!tags) {
    return 0;
  }

  return Object.keys(tags).length;
}

const webhook = resend()
  .instrument(
    createOpenTelemetryInstrumentation({
      includeEventTypeAttribute: true,
    }),
  )
  .withReplayProtection({
    store: replayStore,
  })
  .event(email_delivered, async (payload) => {
    console.log("✅ email.delivered", {
      emailId: payload.data.email_id,
      recipientCount: payload.data.to.length,
      tagCount: countTags(payload.data.tags),
    });
  })
  .event(email_bounced, async (payload) => {
    console.log("⚠️ email.bounced", {
      emailId: payload.data.email_id,
      bounceType: payload.data.bounce.type,
      bounceSubType: payload.data.bounce.subType,
    });
  })
  .event(email_received, async (payload) => {
    console.log("📨 email.received", {
      emailId: payload.data.email_id,
      messageId: payload.data.message_id,
      attachments: payload.data.attachments?.length ?? 0,
    });
    console.log(
      "Resend email.received payloads are metadata-only. Fetch full inbound content via the Receiving API when needed.",
    );
  })
  .event(domain_updated, async (payload) => {
    console.log("🌐 domain.updated", {
      domainId: payload.data.id,
      status: payload.data.status,
      recordCount: payload.data.records.length,
    });
  })
  .event(contact_created, async (payload) => {
    console.log("👤 contact.created", {
      contactId: payload.data.id,
      audienceId: payload.data.audience_id,
      segmentCount: payload.data.segment_ids.length,
      unsubscribed: payload.data.unsubscribed,
    });
  })
  .onError(async (error, context) => {
    console.error("❌ Resend webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Resend verification failed:", reason);
  });

export const POST = toNextJS(webhook, {
  secret: process.env.RESEND_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log(`✅ Successfully processed Resend ${eventType} event`);
  },
});

export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "/api/webhooks/resend",
      supportedEvents,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
