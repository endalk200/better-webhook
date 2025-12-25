import { createHmac } from "crypto";
import type {
  WebhookProvider,
  GeneratedSignature,
  HeaderEntry,
} from "../types/index.js";

/**
 * Generate a Stripe webhook signature
 * Format: t={timestamp},v1={signature}
 * Signature: HMAC-SHA256(timestamp.payload, secret)
 */
export function generateStripeSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): GeneratedSignature {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return {
    header: "Stripe-Signature",
    value: `t=${ts},v1=${signature}`,
  };
}

/**
 * Generate a GitHub webhook signature
 * Format: sha256={signature}
 * Signature: HMAC-SHA256(payload, secret)
 */
export function generateGitHubSignature(
  payload: string,
  secret: string,
): GeneratedSignature {
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  return {
    header: "X-Hub-Signature-256",
    value: `sha256=${signature}`,
  };
}

/**
 * Generate a Shopify webhook signature
 * Format: base64 HMAC-SHA256
 */
export function generateShopifySignature(
  payload: string,
  secret: string,
): GeneratedSignature {
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64");

  return {
    header: "X-Shopify-Hmac-SHA256",
    value: signature,
  };
}

/**
 * Generate a Twilio webhook signature
 * Format: base64 HMAC-SHA1
 */
export function generateTwilioSignature(
  payload: string,
  secret: string,
  url: string,
): GeneratedSignature {
  // Twilio signature is based on URL + sorted POST params
  const signatureInput = url + payload;
  const signature = createHmac("sha1", secret)
    .update(signatureInput)
    .digest("base64");

  return {
    header: "X-Twilio-Signature",
    value: signature,
  };
}

/**
 * Generate a Slack webhook signature
 * Format: v0={signature}
 * Signature: HMAC-SHA256(v0:timestamp:body, secret)
 */
export function generateSlackSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): GeneratedSignature {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signatureBaseString = `v0:${ts}:${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signatureBaseString)
    .digest("hex");

  return {
    header: "X-Slack-Signature",
    value: `v0=${signature}`,
  };
}

/**
 * Generate a Linear webhook signature
 * Format: hex HMAC-SHA256
 */
export function generateLinearSignature(
  payload: string,
  secret: string,
): GeneratedSignature {
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  return {
    header: "Linear-Signature",
    value: signature,
  };
}

/**
 * Generate a Clerk webhook signature using Svix
 * Format: v1,{signature}
 */
export function generateClerkSignature(
  payload: string,
  secret: string,
  timestamp?: number,
  webhookId?: string,
): GeneratedSignature {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const msgId = webhookId || `msg_${Date.now()}`;

  // Clerk uses Svix format: msg_id.timestamp.payload
  const signedPayload = `${msgId}.${ts}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("base64");

  return {
    header: "Svix-Signature",
    value: `v1,${signature}`,
  };
}

/**
 * Generate a SendGrid Event Webhook signature
 */
export function generateSendGridSignature(
  payload: string,
  secret: string,
  timestamp?: number,
): GeneratedSignature {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("base64");

  return {
    header: "X-Twilio-Email-Event-Webhook-Signature",
    value: signature,
  };
}

/**
 * Generate webhook signature based on provider
 */
export function generateSignature(
  provider: WebhookProvider,
  payload: string,
  secret: string,
  options?: { timestamp?: number; url?: string; webhookId?: string },
): GeneratedSignature | null {
  const timestamp = options?.timestamp;

  switch (provider) {
    case "stripe":
      return generateStripeSignature(payload, secret, timestamp);
    case "github":
      return generateGitHubSignature(payload, secret);
    case "shopify":
      return generateShopifySignature(payload, secret);
    case "twilio":
      if (!options?.url) {
        throw new Error("Twilio signature requires URL");
      }
      return generateTwilioSignature(payload, secret, options.url);
    case "slack":
      return generateSlackSignature(payload, secret, timestamp);
    case "linear":
      return generateLinearSignature(payload, secret);
    case "clerk":
      return generateClerkSignature(
        payload,
        secret,
        timestamp,
        options?.webhookId,
      );
    case "sendgrid":
      return generateSendGridSignature(payload, secret, timestamp);
    case "discord":
    case "custom":
    default:
      return null;
  }
}

/**
 * Get additional provider-specific headers
 */
export function getProviderHeaders(
  provider: WebhookProvider,
  options?: { timestamp?: number; webhookId?: string; event?: string },
): HeaderEntry[] {
  const headers: HeaderEntry[] = [];
  const timestamp = options?.timestamp || Math.floor(Date.now() / 1000);

  switch (provider) {
    case "stripe":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        {
          key: "User-Agent",
          value: "Stripe/1.0 (+https://stripe.com/docs/webhooks)",
        },
      );
      break;

    case "github":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        { key: "User-Agent", value: "GitHub-Hookshot/better-webhook" },
        { key: "X-GitHub-Event", value: options?.event || "push" },
        {
          key: "X-GitHub-Delivery",
          value: options?.webhookId || generateDeliveryId(),
        },
      );
      break;

    case "shopify":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        { key: "X-Shopify-Topic", value: options?.event || "orders/create" },
        { key: "X-Shopify-Shop-Domain", value: "example.myshopify.com" },
        { key: "X-Shopify-API-Version", value: "2024-01" },
      );
      break;

    case "slack":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        { key: "X-Slack-Request-Timestamp", value: String(timestamp) },
      );
      break;

    case "clerk":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        { key: "Svix-Id", value: options?.webhookId || `msg_${Date.now()}` },
        { key: "Svix-Timestamp", value: String(timestamp) },
      );
      break;

    case "sendgrid":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        {
          key: "X-Twilio-Email-Event-Webhook-Timestamp",
          value: String(timestamp),
        },
      );
      break;

    case "twilio":
      headers.push({
        key: "Content-Type",
        value: "application/x-www-form-urlencoded",
      });
      break;

    case "linear":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        {
          key: "Linear-Delivery",
          value: options?.webhookId || generateDeliveryId(),
        },
      );
      break;

    case "discord":
      headers.push(
        { key: "Content-Type", value: "application/json" },
        { key: "User-Agent", value: "Discord-Webhook/1.0" },
      );
      break;

    default:
      headers.push({ key: "Content-Type", value: "application/json" });
  }

  return headers;
}

/**
 * Generate a random delivery ID
 */
function generateDeliveryId(): string {
  const chars = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      id += "-";
    } else {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return id;
}

/**
 * Verify a webhook signature
 */
export function verifySignature(
  provider: WebhookProvider,
  payload: string,
  signature: string,
  secret: string,
  options?: { timestamp?: number; url?: string },
): boolean {
  const generated = generateSignature(provider, payload, secret, options);
  if (!generated) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  const a = generated.value;
  const b = signature;

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
