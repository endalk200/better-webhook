import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recall } from "./index.js";
import {
  participant_events_join,
  participant_events_chat_message,
  transcript_data,
  bot_joining_call,
} from "./events.js";
import {
  RecallParticipantEventSchema,
  RecallParticipantChatMessageEventSchema,
  RecallTranscriptDataEventSchema,
  RecallBotEventSchema,
} from "./schemas.js";

const secret = `whsec_${Buffer.from("recall-test-secret").toString("base64")}`;

function createRecallSignature(
  body: string,
  webhookId: string,
  timestamp: string,
  signingSecret: string,
): string {
  const key = Buffer.from(signingSecret.slice("whsec_".length), "base64");
  return createHmac("sha256", key)
    .update(`${webhookId}.${timestamp}.${body}`)
    .digest("base64");
}

function createHeaders(
  body: string,
  signingSecret: string,
  overrides?: {
    webhookId?: string;
    timestamp?: string;
    signature?: string;
  },
) {
  const webhookId = overrides?.webhookId ?? "msg_123";
  const timestamp =
    overrides?.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature =
    overrides?.signature ??
    `v1,${createRecallSignature(body, webhookId, timestamp, signingSecret)}`;

  return {
    "content-type": "application/json",
    "webhook-id": webhookId,
    "webhook-timestamp": timestamp,
    "webhook-signature": signature,
  };
}

const participantEnvelope = {
  event: "participant_events.join",
  data: {
    data: {
      participant: {
        id: 1,
        name: "Ada",
        is_host: true,
        platform: "google_meet",
        extra_data: {},
        email: "ada@example.com",
      },
      timestamp: {
        absolute: "2026-02-12T10:00:00.000Z",
        relative: 1.23,
      },
      data: null,
    },
    realtime_endpoint: {
      id: "rt_1",
      metadata: {},
    },
    participant_events: {
      id: "pe_1",
      metadata: {},
    },
    recording: {
      id: "rec_1",
      metadata: {},
    },
    bot: {
      id: "bot_1",
      metadata: {},
    },
  },
};

const participantChatEnvelope = {
  ...participantEnvelope,
  event: "participant_events.chat_message",
  data: {
    ...participantEnvelope.data,
    data: {
      ...participantEnvelope.data.data,
      data: {
        text: "hello team",
        to: "all",
      },
    },
  },
};

const transcriptEnvelope = {
  event: "transcript.data",
  data: {
    data: {
      words: [
        {
          text: "hello",
          start_timestamp: {
            relative: 2.0,
          },
          end_timestamp: {
            relative: 2.2,
          },
        },
      ],
      participant: {
        id: 2,
        name: "Grace",
        is_host: false,
        platform: "zoom",
        extra_data: {},
        email: "grace@example.com",
      },
    },
    realtime_endpoint: {
      id: "rt_1",
      metadata: {},
    },
    transcript: {
      id: "tr_1",
      metadata: {},
    },
    recording: {
      id: "rec_1",
      metadata: {},
    },
    bot: {
      id: "bot_1",
      metadata: {},
    },
  },
};

const botEnvelope = {
  event: "bot.joining_call",
  data: {
    data: {
      code: "joining_call",
      sub_code: null,
      updated_at: "2026-02-12T10:00:00.000Z",
    },
    bot: {
      id: "bot_1",
      metadata: {},
    },
  },
};

describe("Recall Schemas", () => {
  it("validates participant event payloads", () => {
    const result = RecallParticipantEventSchema.safeParse(participantEnvelope.data);
    expect(result.success).toBe(true);
  });

  it("validates participant chat_message payloads", () => {
    const result = RecallParticipantChatMessageEventSchema.safeParse(
      participantChatEnvelope.data,
    );
    expect(result.success).toBe(true);
  });

  it("validates transcript payloads", () => {
    const result = RecallTranscriptDataEventSchema.safeParse(transcriptEnvelope.data);
    expect(result.success).toBe(true);
  });

  it("validates bot payloads", () => {
    const result = RecallBotEventSchema.safeParse(botEnvelope.data);
    expect(result.success).toBe(true);
  });

  it("rejects invalid bot payloads", () => {
    const result = RecallBotEventSchema.safeParse({
      data: {},
      bot: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("recall()", () => {
  beforeEach(() => {
    delete process.env.RECALL_WEBHOOK_SECRET;
    delete process.env.WEBHOOK_SECRET;
  });

  it("creates a recall webhook builder", () => {
    const webhook = recall();
    expect(webhook).toBeDefined();
    expect(webhook.getProvider().name).toBe("recall");
  });

  it("routes participant events", async () => {
    const body = JSON.stringify(participantEnvelope);
    const headers = createHeaders(body, secret);
    const handler = vi.fn();

    const webhook = recall({ secret }).event(participant_events_join, handler);
    const result = await webhook.process({
      headers,
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participant: expect.objectContaining({ id: 1 }),
        }),
      }),
      expect.objectContaining({
        eventType: "participant_events.join",
        provider: "recall",
        deliveryId: "msg_123",
      }),
    );
  });

  it("routes transcript events", async () => {
    const body = JSON.stringify(transcriptEnvelope);
    const headers = createHeaders(body, secret);
    const handler = vi.fn();

    const webhook = recall({ secret }).event(transcript_data, handler);
    const result = await webhook.process({
      headers,
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          words: expect.arrayContaining([
            expect.objectContaining({ text: "hello" }),
          ]),
        }),
      }),
      expect.objectContaining({
        eventType: "transcript.data",
      }),
    );
  });

  it("routes bot events", async () => {
    const body = JSON.stringify(botEnvelope);
    const headers = createHeaders(body, secret);
    const handler = vi.fn();

    const webhook = recall({ secret }).event(bot_joining_call, handler);
    const result = await webhook.process({
      headers,
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "joining_call" }),
      }),
      expect.objectContaining({
        eventType: "bot.joining_call",
      }),
    );
  });

  it("routes participant chat message events", async () => {
    const body = JSON.stringify(participantChatEnvelope);
    const headers = createHeaders(body, secret);
    const handler = vi.fn();

    const webhook = recall({ secret }).event(
      participant_events_chat_message,
      handler,
    );
    const result = await webhook.process({
      headers,
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({
            text: "hello team",
            to: "all",
          }),
        }),
      }),
      expect.objectContaining({
        eventType: "participant_events.chat_message",
      }),
    );
  });

  it("rejects requests with invalid signatures", async () => {
    const body = JSON.stringify(participantEnvelope);
    const handler = vi.fn();

    const webhook = recall({ secret }).event(participant_events_join, handler);
    const result = await webhook.process({
      headers: createHeaders(body, secret, {
        signature: "v1,invalid-signature",
      }),
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects requests with missing verification headers", async () => {
    const body = JSON.stringify(participantEnvelope);
    const handler = vi.fn();

    const webhook = recall({ secret }).event(participant_events_join, handler);
    const result = await webhook.process({
      headers: {
        "content-type": "application/json",
      },
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects requests when secret is not whsec_ encoded", async () => {
    const body = JSON.stringify(participantEnvelope);
    const headers = createHeaders(body, secret);
    const handler = vi.fn();

    const webhook = recall({ secret: "invalid-secret" }).event(
      participant_events_join,
      handler,
    );

    const result = await webhook.process({
      headers,
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("accepts rotated signatures in a single signature header", async () => {
    const body = JSON.stringify(botEnvelope);
    const webhookId = "msg_456";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const currentSignature = createRecallSignature(
      body,
      webhookId,
      timestamp,
      secret,
    );
    const headerValue = `v1,invalid-signature v1,${currentSignature}`;

    const handler = vi.fn();
    const webhook = recall({ secret }).event(bot_joining_call, handler);

    const result = await webhook.process({
      headers: createHeaders(body, secret, {
        webhookId,
        timestamp,
        signature: headerValue,
      }),
      rawBody: body,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it("rejects requests with stale timestamps", async () => {
    const body = JSON.stringify(botEnvelope);
    const webhookId = "msg_789";
    const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 10);
    const signature = createRecallSignature(body, webhookId, timestamp, secret);
    const handler = vi.fn();
    const webhook = recall({ secret }).event(bot_joining_call, handler);

    const result = await webhook.process({
      headers: createHeaders(body, secret, {
        webhookId,
        timestamp,
        signature: `v1,${signature}`,
      }),
      rawBody: body,
    });

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
