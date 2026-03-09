import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryReplayStore } from "@better-webhook/core";
import { resend } from "./index.js";
import { contact_created, domain_updated, email_delivered } from "./events.js";
import {
  ResendContactCreatedEventSchema,
  ResendContactDeletedEventSchema,
  ResendContactUpdatedEventSchema,
  ResendDomainCreatedEventSchema,
  ResendDomainDeletedEventSchema,
  ResendDomainUpdatedEventSchema,
  ResendEmailBouncedEventSchema,
  ResendEmailClickedEventSchema,
  ResendEmailComplainedEventSchema,
  ResendEmailDeliveredEventSchema,
  ResendEmailDeliveryDelayedEventSchema,
  ResendEmailFailedEventSchema,
  ResendEmailOpenedEventSchema,
  ResendEmailReceivedEventSchema,
  ResendEmailScheduledEventSchema,
  ResendEmailSentEventSchema,
  ResendEmailSuppressedEventSchema,
} from "./schemas.js";

const secret = "whsec_dGVzdF9rZXk=";
const baseTimestamp = "2024-11-22T23:41:12.126Z";
const baseEntityTimestamp = "2024-11-22T23:41:11.894719+00:00";

const baseEmailData = {
  broadcast_id: "8b146471-e88e-4322-86af-016cd36fd216",
  created_at: baseEntityTimestamp,
  email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
  from: "Acme <onboarding@resend.dev>",
  to: ["delivered@resend.dev"],
  subject: "Sending this example",
  template_id: "43f68331-0622-4e15-8202-246a0388854b",
  tags: {
    category: "confirm_email",
  },
};

const emailSentEvent = {
  type: "email.sent",
  created_at: baseTimestamp,
  data: baseEmailData,
};

const emailScheduledEvent = {
  type: "email.scheduled",
  created_at: baseTimestamp,
  data: baseEmailData,
};

const emailDeliveredEvent = {
  type: "email.delivered",
  created_at: baseTimestamp,
  data: baseEmailData,
};

const emailDeliveryDelayedEvent = {
  type: "email.delivery_delayed",
  created_at: baseTimestamp,
  data: baseEmailData,
};

const emailComplainedEvent = {
  type: "email.complained",
  created_at: baseTimestamp,
  data: baseEmailData,
};

const emailBouncedEvent = {
  type: "email.bounced",
  created_at: baseTimestamp,
  data: {
    ...baseEmailData,
    bounce: {
      diagnosticCode: [
        "smtp; 550 5.5.0 Requested action not taken: mailbox unavailable",
      ],
      message:
        "The recipient's email address is on the suppression list because it has a recent history of producing hard bounces.",
      subType: "Suppressed",
      type: "Permanent",
    },
  },
};

const emailOpenedEvent = {
  type: "email.opened",
  created_at: baseTimestamp,
  data: baseEmailData,
};

const emailClickedEvent = {
  type: "email.clicked",
  created_at: baseTimestamp,
  data: {
    ...baseEmailData,
    click: {
      ipAddress: "122.115.53.11",
      link: "https://resend.com",
      timestamp: "2024-11-24T05:00:57.163Z",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    },
  },
};

const emailFailedEvent = {
  type: "email.failed",
  created_at: baseTimestamp,
  data: {
    ...baseEmailData,
    failed: {
      reason: "reached_daily_quota",
    },
  },
};

const emailSuppressedEvent = {
  type: "email.suppressed",
  created_at: baseTimestamp,
  data: {
    ...baseEmailData,
    suppressed: {
      message:
        "Resend has suppressed sending to this address because it is on the account-level suppression list.",
      type: "OnAccountSuppressionList",
    },
  },
};

const emailReceivedEvent = {
  type: "email.received",
  created_at: baseTimestamp,
  data: {
    email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
    created_at: baseEntityTimestamp,
    from: "Acme <onboarding@resend.dev>",
    to: ["delivered@resend.dev"],
    bcc: [],
    cc: [],
    message_id: "<example+123>",
    subject: "Sending this example",
    attachments: [
      {
        id: "2a0c9ce0-3112-4728-976e-47ddcd16a318",
        filename: "avatar.png",
        content_type: "image/png",
        content_disposition: "inline",
        content_id: "img001",
      },
      {
        id: "2a0c9ce0-3112-4728-976e-47ddcd16a319",
        filename: null,
        content_type: "application/pdf",
        content_disposition: null,
        content_id: null,
      },
    ],
  },
};

const domainCreatedEvent = {
  type: "domain.created",
  created_at: "2024-11-17T19:32:22.980Z",
  data: {
    id: "d91cd9bd-1176-453e-8fc1-35364d380206",
    name: "example.com",
    status: "not_started",
    created_at: "2024-04-26T20:21:26.347412+00:00",
    region: "us-east-1",
    records: [
      {
        record: "SPF",
        name: "send",
        type: "TXT",
        ttl: "Auto",
        status: "not_started",
        value: '"v=spf1 include:amazonses.com ~all"',
      },
    ],
  },
};

const domainUpdatedEvent = {
  type: "domain.updated",
  created_at: "2024-11-17T19:32:22.980Z",
  data: {
    id: "d91cd9bd-1176-453e-8fc1-35364d380206",
    name: "example.com",
    status: "partially_verified",
    created_at: "2024-04-26T20:21:26.347412+00:00",
    region: "us-east-1",
    records: [
      {
        record: "Receiving MX",
        name: "inbound.example.com",
        type: "MX",
        ttl: "Auto",
        status: "pending",
        value: "inbound-smtp.us-east-1.amazonaws.com",
        priority: 10,
      },
    ],
  },
};

const domainDeletedEvent = {
  type: "domain.deleted",
  created_at: "2024-11-17T19:32:22.980Z",
  data: {
    id: "d91cd9bd-1176-453e-8fc1-35364d380206",
    name: "example.com",
    status: "verified",
    created_at: "2024-04-26T20:21:26.347412+00:00",
    region: "us-east-1",
    records: [],
  },
};

const contactCreatedEvent = {
  type: "contact.created",
  created_at: "2024-11-17T19:32:22.980Z",
  data: {
    id: "e169aa45-1ecf-4183-9955-b1499d5701d3",
    audience_id: "78261eea-8f8b-4381-83c6-79fa7120f1cf",
    segment_ids: ["78261eea-8f8b-4381-83c6-79fa7120f1cf"],
    created_at: "2024-11-17T19:32:22.980Z",
    updated_at: "2024-11-17T19:32:22.980Z",
    email: "steve.wozniak@gmail.com",
    first_name: "Steve",
    last_name: "Wozniak",
    unsubscribed: false,
  },
};

const contactUpdatedEvent = {
  type: "contact.updated",
  created_at: "2024-11-17T19:32:22.980Z",
  data: {
    id: "e169aa45-1ecf-4183-9955-b1499d5701d3",
    audience_id: "78261eea-8f8b-4381-83c6-79fa7120f1cf",
    segment_ids: ["78261eea-8f8b-4381-83c6-79fa7120f1cf"],
    created_at: "2024-11-17T19:32:22.980Z",
    updated_at: "2024-11-17T19:32:22.980Z",
    email: "steve.wozniak@gmail.com",
    first_name: "Steve",
    last_name: "Wozniak",
    unsubscribed: false,
  },
};

const contactDeletedEvent = {
  type: "contact.deleted",
  created_at: "2024-11-17T19:32:22.980Z",
  data: {
    id: "e169aa45-1ecf-4183-9955-b1499d5701d3",
    audience_id: "78261eea-8f8b-4381-83c6-79fa7120f1cf",
    segment_ids: [],
    created_at: "2024-11-17T19:32:22.980Z",
    updated_at: "2024-11-17T19:32:22.980Z",
    email: "steve.wozniak@gmail.com",
    first_name: "Steve",
    last_name: "Wozniak",
    unsubscribed: true,
  },
};

function createSvixSignature(options: {
  body: string;
  secret: string;
  timestamp: number;
  id: string;
}): string {
  const decodedSecret = Buffer.from(
    options.secret.slice("whsec_".length),
    "base64",
  );
  return createHmac("sha256", decodedSecret)
    .update(`${options.id}.${options.timestamp}.${options.body}`, "utf-8")
    .digest("base64");
}

function createSvixSignatureHeader(options: {
  body: string;
  secret: string;
  timestamp?: number;
  id?: string;
  additionalV1Signatures?: string[];
  validSignaturePosition?: "first" | "last";
}): { id: string; timestamp: number; signature: string } {
  const id = options.id ?? "msg_123";
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const validSignature = createSvixSignature({
    body: options.body,
    secret: options.secret,
    timestamp,
    id,
  });
  const additionalSignatures = options.additionalV1Signatures ?? [];
  const signatures =
    options.validSignaturePosition === "last"
      ? [...additionalSignatures, validSignature]
      : [validSignature, ...additionalSignatures];

  return {
    id,
    timestamp,
    signature: signatures.map((signature) => `v1,${signature}`).join(" "),
  };
}

function createSignedRequest(
  event: unknown,
  options?: {
    secret?: string;
    timestamp?: number;
    id?: string;
    additionalV1Signatures?: string[];
    validSignaturePosition?: "first" | "last";
  },
) {
  const rawBody = JSON.stringify(event);
  const signatureHeader = createSvixSignatureHeader({
    body: rawBody,
    secret: options?.secret ?? secret,
    timestamp: options?.timestamp,
    id: options?.id,
    additionalV1Signatures: options?.additionalV1Signatures,
    validSignaturePosition: options?.validSignaturePosition,
  });

  return {
    rawBody,
    headers: {
      "content-type": "application/json",
      "svix-id": signatureHeader.id,
      "svix-timestamp": String(signatureHeader.timestamp),
      "svix-signature": signatureHeader.signature,
    },
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("Resend Schemas", () => {
  const schemaCases = [
    ["email.sent", ResendEmailSentEventSchema, emailSentEvent],
    ["email.scheduled", ResendEmailScheduledEventSchema, emailScheduledEvent],
    ["email.delivered", ResendEmailDeliveredEventSchema, emailDeliveredEvent],
    [
      "email.delivery_delayed",
      ResendEmailDeliveryDelayedEventSchema,
      emailDeliveryDelayedEvent,
    ],
    [
      "email.complained",
      ResendEmailComplainedEventSchema,
      emailComplainedEvent,
    ],
    ["email.bounced", ResendEmailBouncedEventSchema, emailBouncedEvent],
    ["email.opened", ResendEmailOpenedEventSchema, emailOpenedEvent],
    ["email.clicked", ResendEmailClickedEventSchema, emailClickedEvent],
    ["email.received", ResendEmailReceivedEventSchema, emailReceivedEvent],
    ["email.failed", ResendEmailFailedEventSchema, emailFailedEvent],
    [
      "email.suppressed",
      ResendEmailSuppressedEventSchema,
      emailSuppressedEvent,
    ],
    ["domain.created", ResendDomainCreatedEventSchema, domainCreatedEvent],
    ["domain.updated", ResendDomainUpdatedEventSchema, domainUpdatedEvent],
    ["domain.deleted", ResendDomainDeletedEventSchema, domainDeletedEvent],
    ["contact.created", ResendContactCreatedEventSchema, contactCreatedEvent],
    ["contact.updated", ResendContactUpdatedEventSchema, contactUpdatedEvent],
    ["contact.deleted", ResendContactDeletedEventSchema, contactDeletedEvent],
  ] as const;

  for (const [eventName, schema, payload] of schemaCases) {
    it(`validates ${eventName} payloads`, () => {
      const result = schema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  }

  it("accepts tag arrays for email events", () => {
    const result = ResendEmailSentEventSchema.safeParse({
      ...emailSentEvent,
      data: {
        ...emailSentEvent.data,
        tags: [
          {
            name: "campaign",
            value: "welcome",
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("treats bounce diagnosticCode as optional", () => {
    const result = ResendEmailBouncedEventSchema.safeParse({
      ...emailBouncedEvent,
      data: {
        ...emailBouncedEvent.data,
        bounce: {
          message: emailBouncedEvent.data.bounce.message,
          subType: emailBouncedEvent.data.bounce.subType,
          type: emailBouncedEvent.data.bounce.type,
        },
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("resend()", () => {
  it("processes email.delivered events and exposes svix-id as deliveryId", async () => {
    const handler = vi.fn();
    const webhook = resend({ secret }).event(email_delivered, handler);
    const request = createSignedRequest(emailDeliveredEvent, {
      id: "msg_delivered",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);

    const [, context] = handler.mock.calls[0]!;
    expect(context.deliveryId).toBe("msg_delivered");
    expect(context.provider).toBe("resend");
    expect(context.eventType).toBe("email.delivered");
  });

  it("routes domain.updated events from body.type", async () => {
    const handler = vi.fn();
    const webhook = resend({ secret }).event(domain_updated, handler);
    const request = createSignedRequest(domainUpdatedEvent);

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].data.name).toBe("example.com");
  });

  it("routes contact.created events from body.type", async () => {
    const handler = vi.fn();
    const webhook = resend({ secret }).event(contact_created, handler);
    const request = createSignedRequest(contactCreatedEvent);

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0].data.email).toBe(
      "steve.wozniak@gmail.com",
    );
  });

  it("returns 200 for verified but unhandled events", async () => {
    const webhook = resend({ secret }).event(contact_created, () => {});
    const request = createSignedRequest(emailDeliveredEvent);

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(result.body).toBeUndefined();
  });

  it("rejects requests when svix headers are missing", async () => {
    const webhook = resend({ secret }).event(email_delivered, () => {});

    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
      },
      rawBody: JSON.stringify(emailDeliveredEvent),
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests with malformed timestamps", async () => {
    const rawBody = JSON.stringify(emailDeliveredEvent);
    const webhook = resend({ secret }).event(email_delivered, () => {});

    const result = await webhook.process({
      headers: {
        "svix-id": "msg_invalid",
        "svix-timestamp": "not-a-timestamp",
        "svix-signature": "v1,invalid",
      },
      rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects stale timestamps by default", async () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const webhook = resend({ secret }).event(email_delivered, () => {});
    const request = createSignedRequest(emailDeliveredEvent, {
      timestamp: staleTimestamp,
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("allows stale timestamps when tolerance is disabled", async () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const handler = vi.fn();
    const webhook = resend({
      secret,
      timestampToleranceSeconds: 0,
    }).event(email_delivered, handler);
    const request = createSignedRequest(emailDeliveredEvent, {
      timestamp: staleTimestamp,
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts any valid v1 signature when multiple are present", async () => {
    const webhook = resend({ secret }).event(email_delivered, () => {});
    const request = createSignedRequest(emailDeliveredEvent, {
      additionalV1Signatures: ["invalid-signature"],
      validSignaturePosition: "last",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
  });

  it("supports replay protection using svix-id", async () => {
    const store = createInMemoryReplayStore();
    const handler = vi.fn();
    const webhook = resend({ secret })
      .withReplayProtection({
        store,
      })
      .event(email_delivered, handler);
    const request = createSignedRequest(emailDeliveredEvent, {
      id: "msg_duplicate",
    });

    const first = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });
    const second = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
