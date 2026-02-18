import express from "express";
import { createWebhookStats, type WebhookObserver } from "@better-webhook/core";
import { toExpress } from "@better-webhook/express";
import { github } from "@better-webhook/github";
import { issues, pull_request, push } from "@better-webhook/github/events";
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

const app = express();
const PORT = process.env.PORT || 3001;
const processedReplayKeys = new Set<string>();

function isDuplicateReplay(key: string | undefined): boolean {
  if (!key) {
    return false;
  }
  if (processedReplayKeys.has(key)) {
    return true;
  }
  processedReplayKeys.add(key);
  return false;
}

// Create stats collectors for observability
const githubStats = createWebhookStats();
const ragieStats = createWebhookStats();
const recallStats = createWebhookStats();

// Custom observer for logging webhook lifecycle events
const loggingObserver: WebhookObserver = {
  onRequestReceived: (event) => {
    console.log(
      `📥 [${event.provider}] Webhook received (${event.rawBodyBytes} bytes)`,
    );
  },
  onCompleted: (event) => {
    const status = event.success ? "✓" : "✗";
    console.log(
      `📊 [${event.provider}] ${status} Completed: status=${event.status}, duration=${event.durationMs.toFixed(2)}ms`,
    );
  },
  onVerificationFailed: (event) => {
    console.warn(`🔐 [${event.provider}] Verification failed: ${event.reason}`);
  },
  onHandlerFailed: (event) => {
    console.error(
      `💥 [${event.provider}] Handler ${event.handlerIndex} failed:`,
      event.error.message,
    );
  },
};

// Create a GitHub webhook handler with observability
const githubWebhook = github()
  .observe(githubStats.observer)
  .observe(loggingObserver)
  .event(push, async (payload, context) => {
    const replayKey = context.deliveryId
      ? `github:${context.deliveryId}`
      : undefined;
    if (isDuplicateReplay(replayKey)) {
      console.log("Duplicate GitHub delivery detected, skipping");
      return;
    }
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
  .observe(ragieStats.observer)
  .observe(loggingObserver)
  .event(document_status_updated, async (payload, context) => {
    if (isDuplicateReplay(`ragie:${payload.nonce}`)) {
      console.log("Duplicate Ragie nonce detected, skipping");
      return;
    }
    console.log("📄 Document status updated!");
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Status: ${payload.status}`);
    console.log(`   Partition: ${payload.partition}`);
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
  .observe(recallStats.observer)
  .observe(loggingObserver)
  .event(participant_events_join, async (payload, context) => {
    const replayKey = context.deliveryId
      ? `recall:${context.deliveryId}`
      : undefined;
    if (isDuplicateReplay(replayKey)) {
      console.log("Duplicate Recall delivery detected, skipping");
      return;
    }
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

// Stats endpoint - demonstrates observability
app.get("/stats", (_req, res) => {
  res.json({
    github: githubStats.snapshot(),
    ragie: ragieStats.snapshot(),
    recall: recallStats.snapshot(),
    timestamp: new Date().toISOString(),
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`
🚀 Express webhook server running!
   
   Webhook endpoints:
   - GitHub: http://localhost:${PORT}/webhooks/github
   - Ragie:  http://localhost:${PORT}/webhooks/ragie
   - Recall: http://localhost:${PORT}/webhooks/recall
   
   Health check: http://localhost:${PORT}/health
   Stats:        http://localhost:${PORT}/stats

   Environment variables:
   - GITHUB_WEBHOOK_SECRET (for GitHub webhooks)
   - RAGIE_WEBHOOK_SECRET (for Ragie webhooks)
   - RECALL_WEBHOOK_SECRET (for Recall webhooks)

   To test with ngrok:
   1. ngrok http ${PORT}
   2. Configure webhooks with the ngrok URL + /webhooks/[provider]
  `);
});
