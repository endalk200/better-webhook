import type { Response } from "express";
import { toNestJS } from "@better-webhook/nestjs";
import { recall } from "@better-webhook/recall";
import {
  bot_done,
  participant_events_chat_message,
  participant_events_join,
  transcript_data,
} from "@better-webhook/recall/events";
import type { RawBodyRequest } from "./types.js";
import { toNestRequest, writeNestResult } from "./types.js";

const recallWebhook = recall()
  .event(participant_events_join, async (payload, context) => {
    const participantEvent = payload.data;

    console.log("Recall participant joined", {
      eventType: context.eventType,
      participantId: participantEvent.participant.id,
      participantName: participantEvent.participant.name,
    });
  })
  .event(participant_events_chat_message, async (payload, context) => {
    const participantEvent = payload.data;
    const message = participantEvent.data;

    console.log("Recall chat message received", {
      eventType: context.eventType,
      participantId: participantEvent.participant.id,
      participantName: participantEvent.participant.name,
      text: message.text,
      to: message.to,
    });
  })
  .event(transcript_data, async (payload, context) => {
    const transcript = payload.data;

    console.log("Recall transcript segment received", {
      eventType: context.eventType,
      participantId: transcript.participant.id,
      wordCount: transcript.words.length,
    });
  })
  .event(bot_done, async (payload, context) => {
    const botStatus = payload.data;

    console.log("Recall bot finished", {
      eventType: context.eventType,
      botId: payload.bot.id,
      code: botStatus.code,
      subCode: botStatus.sub_code,
    });
  })
  .onError(async (error, context) => {
    console.error("Recall webhook error", {
      eventType: context.eventType,
      message: error.message,
    });
  })
  .onVerificationFailed(async (reason) => {
    console.error("Recall verification failed", { reason });
  });

const handleRecall = toNestJS(recallWebhook, {
  secret: process.env.RECALL_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log("Recall webhook processed", { eventType });
  },
});

export const recallInfo = {
  status: "ok",
  endpoint: "/webhooks/recall",
  supportedEvents: [
    "participant_events.join",
    "participant_events.chat_message",
    "transcript.data",
    "bot.done",
  ],
};

export async function recallHandler(
  req: RawBodyRequest,
  res: Response,
): Promise<void> {
  const result = await handleRecall(toNestRequest(req));
  writeNestResult(res, result);
}
