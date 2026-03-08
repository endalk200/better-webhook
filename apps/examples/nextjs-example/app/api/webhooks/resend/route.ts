import {
  createInMemoryReplayStore,
  createWebhookStats,
  type WebhookObserver,
} from "@better-webhook/core";
import { toNextJS } from "@better-webhook/nextjs";
import { resend } from "@better-webhook/resend";
import {
  contact_created,
  domain_updated,
  email_bounced,
  email_delivered,
  email_received,
} from "@better-webhook/resend/events";

const stats = createWebhookStats();
const replayStore = createInMemoryReplayStore();

const supportedEvents = [
  "email.delivered",
  "email.bounced",
  "email.received",
  "domain.updated",
  "contact.created",
];

const loggingObserver: WebhookObserver = {
  onRequestReceived: (event) => {
    console.log(
      `📥 Resend webhook received (${event.rawBodyBytes} bytes): ${event.eventType ?? "unknown"}`,
    );
  },
  onCompleted: (event) => {
    console.log(
      `📊 Resend completed: status=${event.status}, duration=${event.durationMs.toFixed(2)}ms`,
    );
  },
};

const webhook = resend()
  .observe(stats.observer)
  .observe(loggingObserver)
  .withReplayProtection({
    store: replayStore,
  })
  .event(email_delivered, async (payload) => {
    console.log("✅ email.delivered", {
      emailId: payload.data.email_id,
      to: payload.data.to,
      subject: payload.data.subject,
    });
  })
  .event(email_bounced, async (payload) => {
    console.log("⚠️ email.bounced", {
      emailId: payload.data.email_id,
      bounceType: payload.data.bounce.type,
      bounceSubType: payload.data.bounce.subType,
      message: payload.data.bounce.message,
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
      name: payload.data.name,
      status: payload.data.status,
      recordCount: payload.data.records.length,
    });
  })
  .event(contact_created, async (payload) => {
    console.log("👤 contact.created", {
      contactId: payload.data.id,
      email: payload.data.email,
      audienceId: payload.data.audience_id,
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
    const snapshot = stats.snapshot();
    console.log(
      `📈 Stats: ${snapshot.totalRequests} total, ${snapshot.successCount} success, avg ${snapshot.avgDurationMs.toFixed(2)}ms`,
    );
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
