import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookBuilder,
  type Headers,
  type Provider,
  type ProviderReplayContext,
} from "@better-webhook/core";

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 60 * 5;
const WEBHOOK_SECRET_PREFIX = "whsec_";
const STRICT_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const STRICT_BASE64_UNPADDED_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}|[A-Za-z0-9+/]{3})?$/;

export type { RecallProvider } from "./events.js";

export type {
  RecallParticipantEvent,
  RecallParticipantChatMessageEvent,
  RecallTranscriptDataEvent,
  RecallTranscriptPartialDataEvent,
  RecallTranscriptProviderDataEvent,
  RecallBotEvent,
  RecallRecordingEvent,
  RecallTranscriptArtifactEvent,
  RecallParticipantEventsArtifactEvent,
  RecallCalendarUpdateEvent,
  RecallCalendarSyncEventsEvent,
  RecallSdkUploadEvent,
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
  RecallRecordingProcessingEvent,
  RecallRecordingDoneEvent,
  RecallRecordingFailedEvent,
  RecallRecordingDeletedEvent,
  RecallTranscriptProcessingEvent,
  RecallTranscriptDoneEvent,
  RecallTranscriptFailedEvent,
  RecallTranscriptDeletedEvent,
  RecallParticipantEventsProcessingEvent,
  RecallParticipantEventsDoneEvent,
  RecallParticipantEventsFailedEvent,
  RecallParticipantEventsDeletedEvent,
  RecallSdkUploadRecordingStartedEvent,
  RecallSdkUploadRecordingEndedEvent,
  RecallSdkUploadCompleteEvent,
  RecallSdkUploadFailedEvent,
} from "./schemas.js";

export interface RecallOptions {
  /**
   * Recall workspace verification secret with `whsec_` prefix.
   */
  secret?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBody(rawBody: string | Buffer): string {
  return typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
}

function normalizeStrictBase64(
  value: string,
  options?: { allowUnpadded?: boolean },
): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  if (STRICT_BASE64_PATTERN.test(value)) {
    return value;
  }

  if (!options?.allowUnpadded || !STRICT_BASE64_UNPADDED_PATTERN.test(value)) {
    return undefined;
  }

  return value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
}

function parseUnixTimestamp(value: string): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const parsedTimestamp = Number(value);
  if (!Number.isSafeInteger(parsedTimestamp) || parsedTimestamp <= 0) {
    return undefined;
  }

  return parsedTimestamp;
}

function decodeRecallSecret(secret: string): Buffer | undefined {
  if (!secret.startsWith(WEBHOOK_SECRET_PREFIX)) {
    return undefined;
  }

  const encodedSecret = secret.slice(WEBHOOK_SECRET_PREFIX.length);
  const normalizedSecret = normalizeStrictBase64(encodedSecret, {
    allowUnpadded: true,
  });
  if (!normalizedSecret) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(normalizedSecret, "base64");
    if (decoded.length === 0) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function secureCompareBase64(left: string, right: string): boolean {
  const normalizedLeft = normalizeStrictBase64(left, { allowUnpadded: true });
  const normalizedRight = normalizeStrictBase64(right, {
    allowUnpadded: true,
  });

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  try {
    const leftBuffer = Buffer.from(normalizedLeft, "base64");
    const rightBuffer = Buffer.from(normalizedRight, "base64");
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function parseSvixSignatures(signatureHeader: string): string[] {
  const signatures: string[] = [];

  for (const versionedSignature of signatureHeader.split(" ")) {
    const trimmedSegment = versionedSignature.trim();
    if (!trimmedSegment) {
      continue;
    }

    const [version, signature] = trimmedSegment.split(",", 2);
    if (version === "v1" && signature) {
      signatures.push(signature);
    }
  }

  return signatures;
}

function resolveAliasedHeader(
  headers: Headers,
  primaryKey: string,
  aliasKey: string,
): { value?: string; mismatch: boolean } {
  const primaryValue = headers[primaryKey];
  const aliasValue = headers[aliasKey];

  if (primaryValue !== undefined && aliasValue !== undefined) {
    if (primaryValue !== aliasValue) {
      return { mismatch: true };
    }
    return { value: primaryValue, mismatch: false };
  }

  return {
    value: primaryValue ?? aliasValue,
    mismatch: false,
  };
}

function resolveRecallHeaderSet(headers: Headers): {
  messageId?: string;
  messageTimestamp?: string;
  messageSignature?: string;
  hasMismatch: boolean;
} {
  const messageId = resolveAliasedHeader(headers, "webhook-id", "svix-id");
  const messageTimestamp = resolveAliasedHeader(
    headers,
    "webhook-timestamp",
    "svix-timestamp",
  );
  const messageSignature = resolveAliasedHeader(
    headers,
    "webhook-signature",
    "svix-signature",
  );

  return {
    messageId: messageId.value,
    messageTimestamp: messageTimestamp.value,
    messageSignature: messageSignature.value,
    hasMismatch:
      messageId.mismatch ||
      messageTimestamp.mismatch ||
      messageSignature.mismatch,
  };
}

function extractReplayContext(headers: Headers): ProviderReplayContext {
  const { messageId, messageTimestamp, hasMismatch } =
    resolveRecallHeaderSet(headers);

  if (hasMismatch) {
    return {
      replayKey: undefined,
      timestamp: undefined,
    };
  }

  const replayKey = messageId?.trim();
  const timestamp = messageTimestamp
    ? parseUnixTimestamp(messageTimestamp)
    : undefined;

  return {
    replayKey: replayKey && replayKey.length > 0 ? replayKey : undefined,
    timestamp,
  };
}

function verifyRecallSignature(
  rawBody: string | Buffer,
  headers: Headers,
  secret: string,
): boolean {
  const { messageId, messageTimestamp, messageSignature, hasMismatch } =
    resolveRecallHeaderSet(headers);

  if (hasMismatch || !messageId || !messageTimestamp || !messageSignature) {
    return false;
  }

  const parsedTimestamp = parseUnixTimestamp(messageTimestamp);
  if (!parsedTimestamp) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageInSeconds = Math.abs(nowSeconds - parsedTimestamp);
  if (ageInSeconds > DEFAULT_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const key = decodeRecallSecret(secret.trim());
  if (!key) {
    return false;
  }

  const passedSignatures = parseSvixSignatures(messageSignature);
  if (passedSignatures.length === 0) {
    return false;
  }

  const payload = normalizeBody(rawBody);
  const toSign = `${messageId}.${messageTimestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", key)
    .update(toSign)
    .digest("base64");

  for (const candidateSignature of passedSignatures) {
    if (secureCompareBase64(expectedSignature, candidateSignature)) {
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
      return extractReplayContext(headers).replayKey;
    },
    getReplayContext(headers: Headers) {
      return extractReplayContext(headers);
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
