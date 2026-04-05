import { createInMemoryReplayStore } from "@better-webhook/core";
import { toNextJS } from "@better-webhook/nextjs";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";
import { stripe } from "@better-webhook/stripe";
import {
  charge_failed,
  checkout_session_completed,
  payment_intent_succeeded,
} from "@better-webhook/stripe/events";

const replayStore = createInMemoryReplayStore();

const webhook = stripe()
  .instrument(
    createOpenTelemetryInstrumentation({
      includeEventTypeAttribute: true,
    }),
  )
  .withReplayProtection({
    store: replayStore,
  })
  .event(charge_failed, async (payload) => {
    console.log("💳 charge.failed");
    console.log(`   Event ID: ${payload.id}`);
    console.log(`   Amount: ${payload.data.object.amount}`);
    console.log(`   Failure: ${payload.data.object.failure_code}`);
  })
  .event(checkout_session_completed, async (payload) => {
    console.log("🧾 checkout.session.completed");
    console.log(`   Event ID: ${payload.id}`);
    console.log(`   Session: ${payload.data.object.id}`);
    console.log(`   Payment status: ${payload.data.object.payment_status}`);
  })
  .event(payment_intent_succeeded, async (payload) => {
    console.log("✅ payment_intent.succeeded");
    console.log(`   Event ID: ${payload.id}`);
    console.log(`   PaymentIntent: ${payload.data.object.id}`);
    console.log(`   Latest charge: ${payload.data.object.latest_charge}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Stripe webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Stripe verification failed:", reason);
  });

export const POST = toNextJS(webhook, {
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log(`✅ Successfully processed Stripe ${eventType} event`);
  },
});

export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "/api/webhooks/stripe",
      supportedEvents: [
        "charge.failed",
        "checkout.session.completed",
        "payment_intent.succeeded",
      ],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
