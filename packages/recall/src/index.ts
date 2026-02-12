import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookBuilder,
  type Headers,
  type Provider,
} from "@better-webhook/core";

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 60 * 5;

export type { RecallProvider } from "./events.js";

export type {
  RecallParticipantEvent,
  RecallParticipantChatMessageEvent,
  RecallTranscriptDataEvent,
  RecallTranscriptPartialDataEvent,
  RecallBotEvent,
  RecallParticipantEventsJoinEvent,
  RecallParticipantEventsLeaveEvent,
  RecallParticipantEventsUpdateEvent,
  RecallParticipantEventsSpeechOnEvent,
  RecallParticipantEventsSpeechOffEvent,
  RecallParticipantEventsWebcamOnEvent,
  RecallParticipantEventsWebcamOffEvent,
  RecallParticipantEventsScreenshareOnEvent,
  RecallParticipantEventsScreenshareOffEvent,
  RecallParticipantEventsChatMessageEvent,
  RecallTranscriptDataPayloadEvent,
  RecallTranscriptPartialDataPayloadEvent,
  RecallBotJoiningCallEvent,
  RecallBotInWaitingRoomEvent,
  RecallBotInCallNotRecordingEvent,
  RecallBotRecordingPermissionAllowedEvent,
  RecallBotRecordingPermissionDeniedEvent,
  RecallBotInCallRecordingEvent,
  RecallBotCallEndedEvent,
  RecallBotDoneEvent,
  RecallBotFatalEvent,
  RecallBotBreakoutRoomEnteredEvent,
  RecallBotBreakoutRoomLeftEvent,
  RecallBotBreakoutRoomOpenedEvent,
  RecallBotBreakoutRoomClosedEvent,
} from "./schemas.js";

export interface RecallOptions {
  /**
   * Recall workspace verification secret with `whsec_` prefix.
   */
  secret?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBody(rawBody: string | Buffer): string {
  return typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
}

function decodeRecallSecret(secret: string): Buffer | undefined {
  if (!secret.startsWith("whsec_")) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(secret.slice("whsec_".length), "base64");
    if (decoded.length === 0) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function secureCompareBase64(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "base64");
    const rightBuffer = Buffer.from(right, "base64");
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function verifyRecallSignature(
  rawBody: string | Buffer,
  headers: Headers,
  secret: string,
): boolean {
  const messageId = headers["webhook-id"] ?? headers["svix-id"];
  const messageTimestamp =
    headers["webhook-timestamp"] ?? headers["svix-timestamp"];
  const messageSignature =
    headers["webhook-signature"] ?? headers["svix-signature"];

  if (!messageId || !messageTimestamp || !messageSignature) {
    return false;
  }

  const parsedTimestamp = Number.parseInt(messageTimestamp, 10);
  if (!Number.isFinite(parsedTimestamp) || parsedTimestamp <= 0) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageInSeconds = Math.abs(nowSeconds - parsedTimestamp);
  if (ageInSeconds > DEFAULT_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const key = decodeRecallSecret(secret);
  if (!key) {
    return false;
  }

  const payload = normalizeBody(rawBody);
  const toSign = `${messageId}.${messageTimestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", key)
    .update(toSign)
    .digest("base64");

  const passedSignatures = messageSignature.split(" ");
  for (const versionedSignature of passedSignatures) {
    const [version, signature] = versionedSignature.split(",", 2);
    if (version !== "v1" || !signature) {
      continue;
    }

    if (secureCompareBase64(expectedSignature, signature)) {
      return true;
    }
  }

  return false;
}

/**
 * Create a Recall.ai provider for webhook handling.
 */
function createRecallProvider(options?: RecallOptions): Provider<"recall"> {
  return {
    name: "recall",
    secret: options?.secret,
    verification: "required",
    getEventType(_headers: Headers, body?: unknown): string | undefined {
      if (!isRecord(body)) {
        return undefined;
      }
      return typeof body.event === "string" ? body.event : undefined;
    },
    getDeliveryId(headers: Headers): string | undefined {
      return headers["webhook-id"] ?? headers["svix-id"];
    },
    verify(
      rawBody: string | Buffer,
      headers: Headers,
      secret: string,
    ): boolean {
      return verifyRecallSignature(rawBody, headers, secret);
    },
    getPayload(body: unknown): unknown {
      if (isRecord(body) && "data" in body) {
        return body.data;
      }
      return body;
    },
  };
}

/**
 * Create a Recall.ai webhook builder.
 */
export function recall(options?: RecallOptions): WebhookBuilder<"recall"> {
  const provider = createRecallProvider(options);
  return new WebhookBuilder(provider);
}
