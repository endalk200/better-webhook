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

export type { ResendProvider } from "./events.js";

export type {
  ResendContactCreatedEvent,
  ResendContactDeletedEvent,
  ResendContactUpdatedEvent,
  ResendDomainCreatedEvent,
  ResendDomainDeletedEvent,
  ResendDomainUpdatedEvent,
  ResendEmailBouncedEvent,
  ResendEmailClickedEvent,
  ResendEmailComplainedEvent,
  ResendEmailDeliveredEvent,
  ResendEmailDeliveryDelayedEvent,
  ResendEmailFailedEvent,
  ResendEmailOpenedEvent,
  ResendEmailReceivedEvent,
  ResendEmailScheduledEvent,
  ResendEmailSentEvent,
  ResendEmailSuppressedEvent,
} from "./schemas.js";

export interface ResendOptions {
  /**
   * Resend webhook signing secret with `whsec_` prefix.
   */
  secret?: string;

  /**
   * Maximum age in seconds for the signed `svix-timestamp`.
   * Set to `0` or a negative value to disable timestamp freshness validation.
   * @default 300
   */
  timestampToleranceSeconds?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBody(rawBody: string | Buffer): string {
  return typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
}

function isStrictBase64(value: string): boolean {
  return value.length > 0 && STRICT_BASE64_PATTERN.test(value);
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

function decodeWebhookSecret(secret: string): Buffer | undefined {
  if (!secret.startsWith(WEBHOOK_SECRET_PREFIX)) {
    return undefined;
  }

  const encodedSecret = secret.slice(WEBHOOK_SECRET_PREFIX.length);
  if (!isStrictBase64(encodedSecret)) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(encodedSecret, "base64");
    if (decoded.length === 0) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function secureCompareBase64(left: string, right: string): boolean {
  if (!isStrictBase64(left) || !isStrictBase64(right)) {
    return false;
  }

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

function extractReplayContext(headers: Headers): ProviderReplayContext {
  const replayKey = headers["svix-id"]?.trim();
  const timestampHeader = headers["svix-timestamp"];
  const timestamp = timestampHeader
    ? parseUnixTimestamp(timestampHeader)
    : undefined;

  return {
    replayKey: replayKey && replayKey.length > 0 ? replayKey : undefined,
    timestamp,
  };
}

function verifyResendSignature(
  rawBody: string | Buffer,
  headers: Headers,
  secret: string,
  timestampToleranceSeconds: number,
): boolean {
  const messageId = headers["svix-id"];
  const messageTimestamp = headers["svix-timestamp"];
  const signatureHeader = headers["svix-signature"];

  if (!messageId || !messageTimestamp || !signatureHeader) {
    return false;
  }

  const parsedTimestamp = parseUnixTimestamp(messageTimestamp);
  if (!parsedTimestamp) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageInSeconds = Math.abs(nowSeconds - parsedTimestamp);
  if (
    timestampToleranceSeconds > 0 &&
    ageInSeconds > timestampToleranceSeconds
  ) {
    return false;
  }

  const signingKey = decodeWebhookSecret(secret.trim());
  if (!signingKey) {
    return false;
  }

  const signatures = parseSvixSignatures(signatureHeader);
  if (signatures.length === 0) {
    return false;
  }

  const signedPayload = `${messageId}.${messageTimestamp}.${normalizeBody(rawBody)}`;
  const expectedSignature = createHmac("sha256", signingKey)
    .update(signedPayload)
    .digest("base64");

  for (const candidateSignature of signatures) {
    if (secureCompareBase64(expectedSignature, candidateSignature)) {
      return true;
    }
  }

  return false;
}

function createResendProvider(options?: ResendOptions): Provider<"resend"> {
  const configuredTimestampTolerance = options?.timestampToleranceSeconds;
  const timestampToleranceSeconds =
    configuredTimestampTolerance !== undefined &&
    Number.isFinite(configuredTimestampTolerance)
      ? configuredTimestampTolerance
      : DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;

  return {
    name: "resend",
    secret: options?.secret,
    verification: "required",
    verifiedUnhandledStatus: 200,
    getEventType(_headers: Headers, body?: unknown): string | undefined {
      if (!isRecord(body)) {
        return undefined;
      }

      return typeof body.type === "string" ? body.type : undefined;
    },
    getDeliveryId(headers: Headers): string | undefined {
      return headers["svix-id"];
    },
    getReplayContext(headers: Headers): ProviderReplayContext {
      return extractReplayContext(headers);
    },
    verify(
      rawBody: string | Buffer,
      headers: Headers,
      secret: string,
    ): boolean {
      return verifyResendSignature(
        rawBody,
        headers,
        secret,
        timestampToleranceSeconds,
      );
    },
  };
}

/**
 * Create a Resend webhook builder with Svix-compatible signature verification.
 */
export function resend(options?: ResendOptions): WebhookBuilder<"resend"> {
  const provider = createResendProvider(options);
  return new WebhookBuilder(provider);
}
