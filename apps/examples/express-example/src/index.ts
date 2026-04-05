import express from "express";
import { createInMemoryReplayStore } from "@better-webhook/core";
import { toExpress } from "@better-webhook/express";
import { github } from "@better-webhook/github";
import { issues, pull_request, push } from "@better-webhook/github/events";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";
import { recall } from "@better-webhook/recall";
import {
  bot_breakout_room_closed,
  bot_breakout_room_entered,
  bot_breakout_room_left,
  bot_breakout_room_opened,
  bot_call_ended,
  bot_done,
  bot_fatal,
  bot_in_call_not_recording,
  bot_in_call_recording,
  bot_in_waiting_room,
  bot_joining_call,
  bot_recording_permission_allowed,
  bot_recording_permission_denied,
  participant_events_chat_message,
  participant_events_join,
  participant_events_leave,
  participant_events_screenshare_off,
  participant_events_screenshare_on,
  participant_events_speech_off,
  participant_events_speech_on,
  participant_events_update,
  participant_events_webcam_off,
  participant_events_webcam_on,
  transcript_data,
  transcript_partial_data,
} from "@better-webhook/recall/events";
import { ragie } from "@better-webhook/ragie";
import {
  connection_sync_finished,
  document_status_updated,
  entity_extracted,
} from "@better-webhook/ragie/events";
import { stripe } from "@better-webhook/stripe";
import {
  charge_failed,
  checkout_session_completed,
  payment_intent_succeeded,
} from "@better-webhook/stripe/events";

const app = express();
const PORT = process.env.PORT || 3001;

const githubReplayStore = createInMemoryReplayStore();
const ragieReplayStore = createInMemoryReplayStore();
const stripeReplayStore = createInMemoryReplayStore();
const recallReplayStore = createInMemoryReplayStore();

const otelInstrumentation = createOpenTelemetryInstrumentation({
  includeEventTypeAttribute: true,
});

// Create a GitHub webhook handler with observability
const githubWebhook = github()
  .instrument(otelInstrumentation)
  .withReplayProtection({ store: githubReplayStore })
  .event(push, async (payload, context) => {
    console.log("📦 Push event received!");
    console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`   Received at: ${context.receivedAt.toISOString()}`);
    console.log(`   Repository: ${payload.repository.full_name}`);
    console.log(`   Branch: ${payload.ref}`);
    console.log(`   Commits: ${payload.commits.length}`);
    payload.commits.forEach((commit) => {
      console.log(`   - ${commit.message} (${commit.id.slice(0, 7)})`);
    });
  })
  .event(pull_request, async (payload, context) => {
    console.log("🔀 Pull request event received!");
    console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`   Action: ${payload.action}`);
    console.log(
      `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
    );
    console.log(`   State: ${payload.pull_request.state}`);
  })
  .event(issues, async (payload, context) => {
    console.log("🎫 Issue event received!");
    console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`   Action: ${payload.action}`);
    console.log(`   Issue #${payload.issue.number}: ${payload.issue.title}`);
    console.log(`   State: ${payload.issue.state}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Verification failed:", reason);
  });

// Create a Ragie webhook handler with observability
const ragieWebhook = ragie()
  .instrument(otelInstrumentation)
  .withReplayProtection({ store: ragieReplayStore })
  .event(document_status_updated, async (payload) => {
    console.log("📄 Document status updated!");
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Status: ${payload.status}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event(connection_sync_finished, async (payload) => {
    console.log("✅ Connection sync finished!");
    console.log(`   Connection ID: ${payload.connection_id}`);
    console.log(`   Sync ID: ${payload.sync_id}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event(entity_extracted, async (payload) => {
    console.log("🔍 Entity extraction completed!");
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Ragie webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Ragie verification failed:", reason);
  });

// Create a Recall webhook handler with observability
const recallWebhook = recall()
  .instrument(otelInstrumentation)
  .withReplayProtection({ store: recallReplayStore })
  .event(participant_events_join, async (payload, context) => {
    console.log("🟢 Recall participant joined");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_leave, async (payload, context) => {
    console.log("🔴 Recall participant left");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_update, async (payload, context) => {
    console.log("📝 Recall participant updated");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_speech_on, async (payload, context) => {
    console.log("🗣️ Recall participant speech on");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_speech_off, async (payload, context) => {
    console.log("🔇 Recall participant speech off");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_webcam_on, async (payload, context) => {
    console.log("📷 Recall participant webcam on");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_webcam_off, async (payload, context) => {
    console.log("📷 Recall participant webcam off");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_screenshare_on, async (payload, context) => {
    console.log("🖥️ Recall participant screenshare on");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_screenshare_off, async (payload, context) => {
    console.log("🖥️ Recall participant screenshare off");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
  })
  .event(participant_events_chat_message, async (payload, context) => {
    console.log("💬 Recall participant chat message");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Participant: ${payload.data.participant.name}`);
    console.log(`   Text: ${payload.data.data.text}`);
  })
  .event(transcript_data, async (payload, context) => {
    console.log("📜 Recall transcript data");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Word count: ${payload.data.words.length}`);
  })
  .event(transcript_partial_data, async (payload, context) => {
    console.log("🧩 Recall transcript partial data");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   Word count: ${payload.data.words.length}`);
  })
  .event(bot_joining_call, async (payload, context) => {
    console.log("🤖 Recall bot joining call");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_in_waiting_room, async (payload, context) => {
    console.log("🤖 Recall bot in waiting room");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_in_call_not_recording, async (payload, context) => {
    console.log("🤖 Recall bot in call not recording");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_recording_permission_allowed, async (payload, context) => {
    console.log("🤖 Recall bot recording permission allowed");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_recording_permission_denied, async (payload, context) => {
    console.log("🤖 Recall bot recording permission denied");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_in_call_recording, async (payload, context) => {
    console.log("🤖 Recall bot in call recording");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_call_ended, async (payload, context) => {
    console.log("🤖 Recall bot call ended");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_done, async (payload, context) => {
    console.log("🤖 Recall bot done");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_fatal, async (payload, context) => {
    console.log("🤖 Recall bot fatal");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_breakout_room_entered, async (payload, context) => {
    console.log("🤖 Recall bot breakout room entered");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_breakout_room_left, async (payload, context) => {
    console.log("🤖 Recall bot breakout room left");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_breakout_room_opened, async (payload, context) => {
    console.log("🤖 Recall bot breakout room opened");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .event(bot_breakout_room_closed, async (payload, context) => {
    console.log("🤖 Recall bot breakout room closed");
    console.log(`   Event: ${context.eventType}`);
    console.log(`   BotId: ${payload.bot.id}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Recall webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Recall verification failed:", reason);
  });

// Create a Stripe webhook handler with observability
const stripeWebhook = stripe()
  .instrument(otelInstrumentation)
  .withReplayProtection({ store: stripeReplayStore })
  .event(charge_failed, async (payload) => {
    console.log("💳 Stripe charge failed");
    console.log(`   Event ID: ${payload.id}`);
    console.log(`   Charge ID: ${payload.data.object.id}`);
    console.log(`   Amount: ${payload.data.object.amount}`);
    console.log(`   Failure: ${payload.data.object.failure_code}`);
  })
  .event(checkout_session_completed, async (payload) => {
    console.log("🧾 Stripe checkout session completed");
    console.log(`   Event ID: ${payload.id}`);
    console.log(`   Session ID: ${payload.data.object.id}`);
    console.log(`   Payment status: ${payload.data.object.payment_status}`);
  })
  .event(payment_intent_succeeded, async (payload) => {
    console.log("✅ Stripe payment intent succeeded");
    console.log(`   Event ID: ${payload.id}`);
    console.log(`   PaymentIntent ID: ${payload.data.object.id}`);
    console.log(`   Latest charge: ${payload.data.object.latest_charge}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Stripe webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Stripe verification failed:", reason);
  });

// Mount the webhook handlers
// Note: express.raw() is required to get the raw body for signature verification
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(githubWebhook, {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed GitHub ${eventType} event`);
    },
  }),
);

app.post(
  "/webhooks/ragie",
  express.raw({ type: "application/json" }),
  toExpress(ragieWebhook, {
    secret: process.env.RAGIE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Ragie ${eventType} event`);
    },
  }),
);

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  toExpress(stripeWebhook, {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Stripe ${eventType} event`);
    },
  }),
);

app.post(
  "/webhooks/recall",
  express.raw({ type: "application/json" }),
  toExpress(recallWebhook, {
    secret: process.env.RECALL_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Recall ${eventType} event`);
    },
  }),
);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`
🚀 Express webhook server running!
   
   Webhook endpoints:
   - GitHub: http://localhost:${PORT}/webhooks/github
   - Ragie:  http://localhost:${PORT}/webhooks/ragie
   - Stripe: http://localhost:${PORT}/webhooks/stripe
   - Recall: http://localhost:${PORT}/webhooks/recall
   
   Health check: http://localhost:${PORT}/health

   Environment variables:
   - GITHUB_WEBHOOK_SECRET (for GitHub webhooks)
   - RAGIE_WEBHOOK_SECRET (for Ragie webhooks)
   - STRIPE_WEBHOOK_SECRET (for Stripe webhooks)
   - RECALL_WEBHOOK_SECRET (for Recall webhooks)

   To test with ngrok:
   1. ngrok http ${PORT}
   2. Configure webhooks with the ngrok URL + /webhooks/[provider]
  `);
});
