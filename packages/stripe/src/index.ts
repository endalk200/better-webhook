import {
  WebhookBuilder,
  type Headers,
  type Provider,
  type ProviderReplayContext,
  verifyHmac,
} from "@better-webhook/core";

/**
 * Provider brand for Stripe webhook builders.
 */
export type { StripeProvider } from "./events.js";

/**
 * Typed Stripe webhook payloads re-exported from `./schemas.js`.
 */
export type {
  StripeChargeFailedEvent,
  StripeCheckoutSessionCompletedEvent,
  StripePaymentIntentSucceededEvent,
} from "./schemas.js";

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;

interface ParsedStripeSignature {
  timestamp?: number;
  signatures: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBody(rawBody: string | Buffer): string {
  return typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
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

function parseStripeSignature(signatureHeader: string): ParsedStripeSignature {
  const signatures: string[] = [];
  let timestamp: number | undefined;

  for (const segment of signatureHeader.split(",")) {
    const [rawKey, rawValue] = segment.split("=", 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (!key || !value) {
      continue;
    }

    if (key === "t") {
      const parsedTimestamp = parseUnixTimestamp(value);
      if (parsedTimestamp !== undefined) {
        // Stripe's Node SDK keeps the last parsed `t=` value, so later header
        // segments intentionally override earlier ones here as well.
        timestamp = parsedTimestamp;
      }
      continue;
    }

    if (key === "v1") {
      signatures.push(value);
    }
  }

  return { timestamp, signatures };
}

function verifyStripeSignature(
  rawBody: string | Buffer,
  headers: Headers,
  secret: string,
  timestampToleranceSeconds: number,
): boolean {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret) {
    return false;
  }

  const signatureHeader = headers["stripe-signature"];
  if (!signatureHeader) {
    return false;
  }

  const parsedSignature = parseStripeSignature(signatureHeader);
  if (!parsedSignature.timestamp || parsedSignature.signatures.length === 0) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageInSeconds = Math.abs(nowSeconds - parsedSignature.timestamp);
  if (
    timestampToleranceSeconds > 0 &&
    ageInSeconds > timestampToleranceSeconds
  ) {
    return false;
  }

  const signedPayload = `${parsedSignature.timestamp}.${normalizeBody(rawBody)}`;
  for (const candidateSignature of parsedSignature.signatures) {
    if (
      verifyHmac({
        algorithm: "sha256",
        rawBody: signedPayload,
        secret: normalizedSecret,
        signature: candidateSignature,
      })
    ) {
      return true;
    }
  }

  return false;
}

export interface StripeOptions {
  /**
   * Stripe webhook signing secret (starts with `whsec_`).
   */
  secret?: string;

  /**
   * Maximum age in seconds for the timestamp embedded in `Stripe-Signature`.
   * Set to 0 or a negative value to disable timestamp freshness validation.
   * @default 300
   */
  timestampToleranceSeconds?: number;
}

function createStripeProvider(options?: StripeOptions): Provider<"stripe"> {
  const configuredTimestampTolerance = options?.timestampToleranceSeconds;
  const timestampToleranceSeconds =
    configuredTimestampTolerance !== undefined &&
    Number.isFinite(configuredTimestampTolerance)
      ? configuredTimestampTolerance
      : DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;

  return {
    name: "stripe",
    secret: options?.secret,
    verification: "required",
    getEventType(_headers: Headers, body?: unknown): string | undefined {
      if (!isRecord(body)) {
        return undefined;
      }
      return typeof body.type === "string" ? body.type : undefined;
    },
    getDeliveryId(_headers: Headers): string | undefined {
      // Stripe doesn't expose a dedicated delivery-id header.
      return undefined;
    },
    getReplayContext(headers: Headers, body?: unknown): ProviderReplayContext {
      const signatureHeader = headers["stripe-signature"];
      const parsedSignature = signatureHeader
        ? parseStripeSignature(signatureHeader)
        : undefined;

      const replayKey =
        isRecord(body) && typeof body.id === "string" ? body.id : undefined;

      return {
        replayKey,
        timestamp: parsedSignature?.timestamp,
      };
    },
    verify(
      rawBody: string | Buffer,
      headers: Headers,
      secret: string,
    ): boolean {
      return verifyStripeSignature(
        rawBody,
        headers,
        secret,
        timestampToleranceSeconds,
      );
    },
  };
}

/**
 * Create a Stripe webhook builder with signature verification and replay context support.
 *
 * @param options - Stripe provider options, including secret and timestamp tolerance.
 * @returns A webhook builder configured with the Stripe provider.
 */
export function stripe(options?: StripeOptions): WebhookBuilder<"stripe"> {
  const provider = createStripeProvider(options);
  return new WebhookBuilder(provider);
}
