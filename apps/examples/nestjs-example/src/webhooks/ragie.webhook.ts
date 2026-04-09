import type { Response } from "express";
import { toNestJS } from "@better-webhook/nestjs";
import { ragie } from "@better-webhook/ragie";
import {
  connection_sync_finished,
  document_status_updated,
  entity_extracted,
} from "@better-webhook/ragie/events";
import type { RawBodyRequest } from "./types.js";
import { toNestRequest, writeNestResult } from "./types.js";

const ragieWebhook = ragie()
  .event(document_status_updated, async (payload) => {
    console.log("Ragie document status updated", {
      documentId: payload.document_id,
      status: payload.status,
      partition: payload.partition,
    });
  })
  .event(connection_sync_finished, async (payload) => {
    console.log("Ragie connection sync finished", {
      connectionId: payload.connection_id,
      syncId: payload.sync_id,
      partition: payload.partition,
    });
  })
  .event(entity_extracted, async (payload) => {
    console.log("Ragie entity extracted", {
      entityId: payload.entity_id,
      documentId: payload.document_id,
      instructionId: payload.instruction_id,
    });
  })
  .onError(async (error, context) => {
    console.error("Ragie webhook error", {
      eventType: context.eventType,
      message: error.message,
    });
  })
  .onVerificationFailed(async (reason) => {
    console.error("Ragie verification failed", { reason });
  });

const handleRagie = toNestJS(ragieWebhook, {
  secret: process.env.RAGIE_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log("Ragie webhook processed", { eventType });
  },
});

export const ragieInfo = {
  status: "ok",
  endpoint: "/webhooks/ragie",
  supportedEvents: [
    "document_status_updated",
    "connection_sync_finished",
    "entity_extracted",
  ],
};

export async function ragieHandler(
  req: RawBodyRequest,
  res: Response,
): Promise<void> {
  const result = await handleRagie(toNestRequest(req));
  writeNestResult(res, result);
}
