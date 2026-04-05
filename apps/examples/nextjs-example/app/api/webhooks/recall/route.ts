import { createInMemoryReplayStore } from "@better-webhook/core";
import { toNextJS } from "@better-webhook/nextjs";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";
import { recall } from "@better-webhook/recall";
import {
  participant_events_join,
  participant_events_leave,
  participant_events_update,
  participant_events_speech_on,
  participant_events_speech_off,
  participant_events_webcam_on,
  participant_events_webcam_off,
  participant_events_screenshare_on,
  participant_events_screenshare_off,
  participant_events_chat_message,
  transcript_data,
  transcript_partial_data,
  bot_joining_call,
  bot_in_waiting_room,
  bot_in_call_not_recording,
  bot_recording_permission_allowed,
  bot_recording_permission_denied,
  bot_in_call_recording,
  bot_call_ended,
  bot_done,
  bot_fatal,
  bot_breakout_room_entered,
  bot_breakout_room_left,
  bot_breakout_room_opened,
  bot_breakout_room_closed,
} from "@better-webhook/recall/events";

const recallReplayStore = createInMemoryReplayStore();

const webhook = recall()
  .instrument(
    createOpenTelemetryInstrumentation({
      includeEventTypeAttribute: true,
    }),
  )
  .withReplayProtection({ store: recallReplayStore })
  .event(participant_events_join, async (payload, context) => {
    console.log("🟢 participant joined", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
      participantName: payload.data.participant.name,
    });
  })
  .event(participant_events_leave, async (payload, context) => {
    console.log("🔴 participant left", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
      participantName: payload.data.participant.name,
    });
  })
  .event(participant_events_update, async (payload, context) => {
    console.log("📝 participant updated", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
      participantName: payload.data.participant.name,
    });
  })
  .event(participant_events_speech_on, async (payload, context) => {
    console.log("🗣️ participant speech on", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
    });
  })
  .event(participant_events_speech_off, async (payload, context) => {
    console.log("🔇 participant speech off", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
    });
  })
  .event(participant_events_webcam_on, async (payload, context) => {
    console.log("📷 participant webcam on", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
    });
  })
  .event(participant_events_webcam_off, async (payload, context) => {
    console.log("📷 participant webcam off", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
    });
  })
  .event(participant_events_screenshare_on, async (payload, context) => {
    console.log("🖥️ participant screenshare on", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
    });
  })
  .event(participant_events_screenshare_off, async (payload, context) => {
    console.log("🖥️ participant screenshare off", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
    });
  })
  .event(participant_events_chat_message, async (payload, context) => {
    console.log("💬 participant chat message", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
      text: payload.data.data.text,
      to: payload.data.data.to,
    });
  })
  .event(transcript_data, async (payload, context) => {
    console.log("📜 transcript data", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
      words: payload.data.words.map((word) => word.text).join(" "),
    });
  })
  .event(transcript_partial_data, async (payload, context) => {
    console.log("🧩 transcript partial", {
      eventType: context.eventType,
      participantId: payload.data.participant.id,
      wordCount: payload.data.words.length,
    });
  })
  .event(bot_joining_call, async (payload, context) => {
    console.log("🤖 bot joining call", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_in_waiting_room, async (payload, context) => {
    console.log("🤖 bot in waiting room", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_in_call_not_recording, async (payload, context) => {
    console.log("🤖 bot in call not recording", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_recording_permission_allowed, async (payload, context) => {
    console.log("🤖 bot recording permission allowed", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_recording_permission_denied, async (payload, context) => {
    console.log("🤖 bot recording permission denied", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_in_call_recording, async (payload, context) => {
    console.log("🤖 bot in call recording", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_call_ended, async (payload, context) => {
    console.log("🤖 bot call ended", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_done, async (payload, context) => {
    console.log("🤖 bot done", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_fatal, async (payload, context) => {
    console.log("🤖 bot fatal", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_breakout_room_entered, async (payload, context) => {
    console.log("🤖 bot breakout room entered", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_breakout_room_left, async (payload, context) => {
    console.log("🤖 bot breakout room left", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_breakout_room_opened, async (payload, context) => {
    console.log("🤖 bot breakout room opened", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .event(bot_breakout_room_closed, async (payload, context) => {
    console.log("🤖 bot breakout room closed", {
      eventType: context.eventType,
      code: payload.data.code,
      subCode: payload.data.sub_code,
    });
  })
  .onError(async (error, context) => {
    console.error("❌ Recall webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason, headers) => {
    console.error("🔐 Recall verification failed:", reason);
    console.log("Verification header presence:", {
      hasWebhookId: typeof headers["webhook-id"] === "string",
      hasTimestamp: typeof headers["webhook-timestamp"] === "string",
      hasSignature: typeof headers["webhook-signature"] === "string",
    });
    console.log(
      "Tip: avoid logging raw signature/header values in production environments.",
    );
  });

export const POST = toNextJS(webhook, {
  secret: process.env.RECALL_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log(`✅ Successfully processed Recall ${eventType} event`);
  },
});

export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "/api/webhooks/recall",
      supportedEvents: [
        "participant_events.join",
        "participant_events.leave",
        "participant_events.update",
        "participant_events.speech_on",
        "participant_events.speech_off",
        "participant_events.webcam_on",
        "participant_events.webcam_off",
        "participant_events.screenshare_on",
        "participant_events.screenshare_off",
        "participant_events.chat_message",
        "transcript.data",
        "transcript.partial_data",
        "bot.joining_call",
        "bot.in_waiting_room",
        "bot.in_call_not_recording",
        "bot.recording_permission_allowed",
        "bot.recording_permission_denied",
        "bot.in_call_recording",
        "bot.call_ended",
        "bot.done",
        "bot.fatal",
        "bot.breakout_room_entered",
        "bot.breakout_room_left",
        "bot.breakout_room_opened",
        "bot.breakout_room_closed",
      ],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
