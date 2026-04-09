import { toNextJS } from "@better-webhook/nextjs";
import { stripe } from "@better-webhook/stripe";
import {
  charge_failed,
  checkout_session_completed,
  payment_intent_succeeded,
} from "@better-webhook/stripe/events";

const webhook = stripe()
  .event(charge_failed, async (payload) => {
    console.log("Stripe charge failed", {
      eventId: payload.id,
      chargeId: payload.data.object.id,
      amount: payload.data.object.amount,
      failureCode: payload.data.object.failure_code,
    });
  })
  .event(checkout_session_completed, async (payload) => {
    console.log("Stripe checkout completed", {
      eventId: payload.id,
      sessionId: payload.data.object.id,
      paymentStatus: payload.data.object.payment_status,
    });
  })
  .event(payment_intent_succeeded, async (payload) => {
    console.log("Stripe payment intent succeeded", {
      eventId: payload.id,
      paymentIntentId: payload.data.object.id,
      latestCharge: payload.data.object.latest_charge,
    });
  })
  .onError(async (error, context) => {
    console.error("Stripe webhook error", {
      eventType: context.eventType,
      message: error.message,
    });
  })
  .onVerificationFailed(async (reason) => {
    console.error("Stripe verification failed", { reason });
  });

export const POST = toNextJS(webhook, {
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log("Stripe webhook processed", { eventType });
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
