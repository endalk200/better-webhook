import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryReplayStore } from "@better-webhook/core";
import { recall } from "./index.js";
import {
  bot_breakout_room_closed,
  bot_breakout_room_entered,
  bot_breakout_room_left,
  bot_breakout_room_opened,
  bot_call_ended,
  bot_done,
  bot_fatal,
  bot_in_call_not_recording,
  bot_in_call_recording,
  bot_in_waiting_room,
  bot_joining_call,
  bot_recording_permission_allowed,
  bot_recording_permission_denied,
  calendar_sync_events,
  calendar_update,
  participant_events_chat_message,
  participant_events_deleted,
  participant_events_done,
  participant_events_failed,
  participant_events_join,
  participant_events_leave,
  participant_events_processing,
  participant_events_screenshare_off,
  participant_events_screenshare_on,
  participant_events_speech_off,
  participant_events_speech_on,
  participant_events_update,
  participant_events_webcam_off,
  participant_events_webcam_on,
  recording_deleted,
  recording_done,
  recording_failed,
  recording_processing,
  sdk_upload_complete,
  sdk_upload_failed,
  sdk_upload_recording_ended,
  sdk_upload_recording_started,
  transcript_data,
  transcript_deleted,
  transcript_done,
  transcript_failed,
  transcript_partial_data,
  transcript_processing,
  transcript_provider_data,
} from "./events.js";
import {
  RecallBotEventSchema,
  RecallBotDoneEventSchema,
  RecallBotJoiningCallEventSchema,
  RecallCalendarSyncEventsEventSchema,
  RecallCalendarUpdateEventSchema,
  RecallParticipantChatMessageEventSchema,
  RecallParticipantEventSchema,
  RecallParticipantEventsArtifactEventSchema,
  RecallParticipantEventsDoneEventSchema,
  RecallRecordingEventSchema,
  RecallRecordingDoneEventSchema,
  RecallSdkUploadEventSchema,
  RecallTranscriptArtifactEventSchema,
  RecallTranscriptDataEventSchema,
  RecallTranscriptPartialDataEventSchema,
  RecallTranscriptDoneEventSchema,
  RecallTranscriptProviderDataEventSchema,
} from "./schemas.js";

const secret = `whsec_${Buffer.from("recall-test-secret").toString("base64")}`;
const currentDir = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(currentDir, "../../../templates/recall");

type HeaderFamily = "webhook" | "svix";

type RecallFixture = {
  body: {
    event: string;
    data: unknown;
  };
  description: string;
  event: string;
  provider: string;
};

function loadFixture(name: string): RecallFixture {
  const content = readFileSync(resolve(templatesDir, `${name}.jsonc`), "utf-8");
  const normalizedContent = content.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(normalizedContent) as RecallFixture;
}

function createRecallSignature(options: {
  body: string;
  signingSecret: string;
  timestamp: string;
  webhookId: string;
}): string {
  const key = Buffer.from(
    options.signingSecret.slice("whsec_".length),
    "base64",
  );
  return createHmac("sha256", key)
    .update(`${options.webhookId}.${options.timestamp}.${options.body}`)
    .digest("base64");
}

function createHeaders(options: {
  body: string;
  signingSecret?: string;
  family?: HeaderFamily;
  webhookId?: string;
  timestamp?: string;
  signature?: string;
  includeAlias?: boolean;
  aliasWebhookId?: string;
  aliasTimestamp?: string;
  aliasSignature?: string;
}): Record<string, string> {
  const family = options.family ?? "webhook";
  const webhookId = options.webhookId ?? "msg_123";
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signingSecret = options.signingSecret ?? secret;
  const signature =
    options.signature ??
    `v1,${createRecallSignature({
      body: options.body,
      signingSecret,
      timestamp,
      webhookId,
    })}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  const primaryPrefix = family;
  headers[`${primaryPrefix}-id`] = webhookId;
  headers[`${primaryPrefix}-timestamp`] = timestamp;
  headers[`${primaryPrefix}-signature`] = signature;

  if (options.includeAlias) {
    const aliasPrefix = family === "webhook" ? "svix" : "webhook";
    headers[`${aliasPrefix}-id`] = options.aliasWebhookId ?? webhookId;
    headers[`${aliasPrefix}-timestamp`] = options.aliasTimestamp ?? timestamp;
    headers[`${aliasPrefix}-signature`] = options.aliasSignature ?? signature;
  }

  return headers;
}

function createSignedRequest(
  fixtureName: string,
  options?: {
    family?: HeaderFamily;
    signingSecret?: string;
    webhookId?: string;
    timestamp?: string;
    signature?: string;
    includeAlias?: boolean;
    aliasWebhookId?: string;
    aliasTimestamp?: string;
    aliasSignature?: string;
    bodyOverride?: RecallFixture["body"];
  },
) {
  const fixture = loadFixture(fixtureName);
  const body = options?.bodyOverride ?? fixture.body;
  const rawBody = JSON.stringify(body);

  return {
    fixture,
    body,
    rawBody,
    headers: createHeaders({
      body: rawBody,
      family: options?.family,
      signingSecret: options?.signingSecret,
      webhookId: options?.webhookId,
      timestamp: options?.timestamp,
      signature: options?.signature,
      includeAlias: options?.includeAlias,
      aliasWebhookId: options?.aliasWebhookId,
      aliasTimestamp: options?.aliasTimestamp,
      aliasSignature: options?.aliasSignature,
    }),
  };
}

const schemaCases = [
  [
    "participant event payloads",
    RecallParticipantEventSchema,
    loadFixture("recall-participant_events_join").body.data,
  ],
  [
    "participant chat message payloads",
    RecallParticipantChatMessageEventSchema,
    loadFixture("recall-participant_events_chat_message").body.data,
  ],
  [
    "transcript payloads",
    RecallTranscriptDataEventSchema,
    loadFixture("recall-transcript_data").body.data,
  ],
  [
    "transcript partial payloads",
    RecallTranscriptPartialDataEventSchema,
    loadFixture("recall-transcript_partial_data").body.data,
  ],
  [
    "transcript provider data payloads",
    RecallTranscriptProviderDataEventSchema,
    loadFixture("recall-transcript_provider_data").body.data,
  ],
  [
    "bot payloads",
    RecallBotEventSchema,
    loadFixture("recall-bot_done").body.data,
  ],
  [
    "recording payloads",
    RecallRecordingEventSchema,
    loadFixture("recall-recording_done").body.data,
  ],
  [
    "transcript artifact payloads",
    RecallTranscriptArtifactEventSchema,
    loadFixture("recall-transcript_done").body.data,
  ],
  [
    "participant events artifact payloads",
    RecallParticipantEventsArtifactEventSchema,
    loadFixture("recall-participant_events_done").body.data,
  ],
  [
    "calendar.update payloads",
    RecallCalendarUpdateEventSchema,
    loadFixture("recall-calendar_update").body.data,
  ],
  [
    "calendar.sync_events payloads",
    RecallCalendarSyncEventsEventSchema,
    loadFixture("recall-calendar_sync_events").body.data,
  ],
  [
    "sdk upload payloads",
    RecallSdkUploadEventSchema,
    loadFixture("recall-sdk_upload_complete").body.data,
  ],
] as const;

const dispatchCases = [
  ["recall-participant_events_join", participant_events_join],
  ["recall-participant_events_leave", participant_events_leave],
  ["recall-participant_events_update", participant_events_update],
  ["recall-participant_events_speech_on", participant_events_speech_on],
  ["recall-participant_events_speech_off", participant_events_speech_off],
  ["recall-participant_events_webcam_on", participant_events_webcam_on],
  ["recall-participant_events_webcam_off", participant_events_webcam_off],
  [
    "recall-participant_events_screenshare_on",
    participant_events_screenshare_on,
  ],
  [
    "recall-participant_events_screenshare_off",
    participant_events_screenshare_off,
  ],
  ["recall-participant_events_chat_message", participant_events_chat_message],
  ["recall-participant_events_processing", participant_events_processing],
  ["recall-participant_events_done", participant_events_done],
  ["recall-participant_events_failed", participant_events_failed],
  ["recall-participant_events_deleted", participant_events_deleted],
  ["recall-transcript_data", transcript_data],
  ["recall-transcript_partial_data", transcript_partial_data],
  ["recall-transcript_provider_data", transcript_provider_data],
  ["recall-transcript_processing", transcript_processing],
  ["recall-transcript_done", transcript_done],
  ["recall-transcript_failed", transcript_failed],
  ["recall-transcript_deleted", transcript_deleted],
  ["recall-recording_processing", recording_processing],
  ["recall-recording_done", recording_done],
  ["recall-recording_failed", recording_failed],
  ["recall-recording_deleted", recording_deleted],
  ["recall-bot_joining_call", bot_joining_call],
  ["recall-bot_in_waiting_room", bot_in_waiting_room],
  ["recall-bot_in_call_not_recording", bot_in_call_not_recording],
  ["recall-bot_recording_permission_allowed", bot_recording_permission_allowed],
  ["recall-bot_recording_permission_denied", bot_recording_permission_denied],
  ["recall-bot_in_call_recording", bot_in_call_recording],
  ["recall-bot_call_ended", bot_call_ended],
  ["recall-bot_done", bot_done],
  ["recall-bot_fatal", bot_fatal],
  ["recall-bot_breakout_room_entered", bot_breakout_room_entered],
  ["recall-bot_breakout_room_left", bot_breakout_room_left],
  ["recall-bot_breakout_room_opened", bot_breakout_room_opened],
  ["recall-bot_breakout_room_closed", bot_breakout_room_closed],
  ["recall-calendar_update", calendar_update],
  ["recall-calendar_sync_events", calendar_sync_events],
  ["recall-sdk_upload_recording_started", sdk_upload_recording_started],
  ["recall-sdk_upload_recording_ended", sdk_upload_recording_ended],
  ["recall-sdk_upload_complete", sdk_upload_complete],
  ["recall-sdk_upload_failed", sdk_upload_failed],
] as const;

beforeEach(() => {
  delete process.env.RECALL_WEBHOOK_SECRET;
  delete process.env.WEBHOOK_SECRET;
});

describe("Recall Schemas", () => {
  for (const [label, schema, payload] of schemaCases) {
    it(`validates ${label}`, () => {
      const result = schema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  }

  it("rejects invalid bot payloads", () => {
    const result = RecallBotEventSchema.safeParse({
      data: {},
      bot: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects bot event payloads when data.code does not match the event schema", () => {
    const payload = loadFixture("recall-bot_done").body.data;
    const result = RecallBotJoiningCallEventSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });

  it("rejects recording artifact payloads when data.code does not match the event schema", () => {
    const payload = loadFixture("recall-recording_processing").body.data;
    const result = RecallRecordingDoneEventSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });

  it("rejects transcript artifact payloads when data.code does not match the event schema", () => {
    const payload = loadFixture("recall-transcript_failed").body.data;
    const result = RecallTranscriptDoneEventSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });

  it("rejects participant events artifact payloads when data.code does not match the event schema", () => {
    const payload = loadFixture("recall-participant_events_failed").body.data;
    const result = RecallParticipantEventsDoneEventSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });

  it("accepts matching event-specific schemas for status-driven Recall events", () => {
    expect(
      RecallBotDoneEventSchema.safeParse(
        loadFixture("recall-bot_done").body.data,
      ).success,
    ).toBe(true);
    expect(
      RecallRecordingDoneEventSchema.safeParse(
        loadFixture("recall-recording_done").body.data,
      ).success,
    ).toBe(true);
    expect(
      RecallTranscriptDoneEventSchema.safeParse(
        loadFixture("recall-transcript_done").body.data,
      ).success,
    ).toBe(true);
    expect(
      RecallParticipantEventsDoneEventSchema.safeParse(
        loadFixture("recall-participant_events_done").body.data,
      ).success,
    ).toBe(true);
  });
});

describe("recall()", () => {
  it("creates a recall webhook builder", () => {
    const webhook = recall();
    expect(webhook).toBeDefined();
    expect(webhook.getProvider().name).toBe("recall");
  });

  it("exposes replay context from webhook headers", () => {
    const provider = recall().getProvider();
    const replayContext = provider.getReplayContext?.({
      "webhook-id": "msg_123",
      "webhook-timestamp": "1700000000",
    });

    expect(replayContext).toEqual({
      replayKey: "msg_123",
      timestamp: 1700000000,
    });
  });

  it("exposes replay context from svix headers", () => {
    const provider = recall().getProvider();
    const replayContext = provider.getReplayContext?.({
      "svix-id": "msg_svix_123",
      "svix-timestamp": "1700000001",
    });

    expect(replayContext).toEqual({
      replayKey: "msg_svix_123",
      timestamp: 1700000001,
    });
  });

  it("trims replay key headers and ignores whitespace-only values", () => {
    const provider = recall().getProvider();
    const replayContext = provider.getReplayContext?.({
      "webhook-id": "   ",
      "webhook-timestamp": "1700000000",
    });

    expect(replayContext).toEqual({
      replayKey: undefined,
      timestamp: 1700000000,
    });
  });

  it("returns undefined replay metadata when aliased headers disagree", () => {
    const provider = recall().getProvider();
    const replayContext = provider.getReplayContext?.({
      "webhook-id": "msg_123",
      "svix-id": "msg_456",
      "webhook-timestamp": "1700000000",
      "svix-timestamp": "1700000001",
    });

    expect(replayContext).toEqual({
      replayKey: undefined,
      timestamp: undefined,
    });
    expect(
      provider.getDeliveryId({
        "webhook-id": "msg_123",
        "svix-id": "msg_456",
      }),
    ).toBeUndefined();
  });

  for (const [fixtureName, eventDefinition] of dispatchCases) {
    it(`routes ${eventDefinition.name}`, async () => {
      const handler = vi.fn();
      const webhook = recall({ secret }).event(eventDefinition, handler);
      const request = createSignedRequest(fixtureName);

      const result = await webhook.process({
        headers: request.headers,
        rawBody: request.rawBody,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
      const [, context] = handler.mock.calls[0]!;
      expect(context).toEqual(
        expect.objectContaining({
          provider: "recall",
          eventType: eventDefinition.name,
          deliveryId: "msg_123",
        }),
      );
    });
  }

  it("accepts requests signed with svix headers only", async () => {
    const handler = vi.fn();
    const webhook = recall({ secret }).event(transcript_data, handler);
    const request = createSignedRequest("recall-transcript_data", {
      family: "svix",
      webhookId: "msg_svix_only",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![1].deliveryId).toBe("msg_svix_only");
  });

  it("accepts requests when webhook and svix headers are both present and equal", async () => {
    const handler = vi.fn();
    const webhook = recall({ secret }).event(bot_joining_call, handler);
    const request = createSignedRequest("recall-bot_joining_call", {
      includeAlias: true,
      webhookId: "msg_equal_aliases",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects requests when webhook and svix ids differ", async () => {
    const webhook = recall({ secret }).event(participant_events_join, () => {});
    const request = createSignedRequest("recall-participant_events_join", {
      includeAlias: true,
      aliasWebhookId: "msg_mismatch",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests when webhook and svix timestamps differ", async () => {
    const webhook = recall({ secret }).event(participant_events_join, () => {});
    const request = createSignedRequest("recall-participant_events_join", {
      includeAlias: true,
      aliasTimestamp: "123",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests when webhook and svix signatures differ", async () => {
    const webhook = recall({ secret }).event(participant_events_join, () => {});
    const request = createSignedRequest("recall-participant_events_join", {
      includeAlias: true,
      aliasSignature: "v1,ZmFrZQ==",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests with invalid signatures", async () => {
    const webhook = recall({ secret }).event(participant_events_join, () => {});
    const request = createSignedRequest("recall-participant_events_join", {
      signature: "v1,invalid-signature",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests with missing verification headers", async () => {
    const request = createSignedRequest("recall-participant_events_join");
    const webhook = recall({ secret }).event(participant_events_join, () => {});

    const result = await webhook.process({
      headers: { "content-type": "application/json" },
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests when secret is not whsec_ encoded", async () => {
    const webhook = recall({ secret: "invalid-secret" }).event(
      participant_events_join,
      () => {},
    );
    const request = createSignedRequest("recall-participant_events_join");

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests when the secret is malformed base64", async () => {
    const malformedSecret = "whsec_not-base64!";
    const webhook = recall({ secret: malformedSecret }).event(
      participant_events_join,
      () => {},
    );
    const request = createSignedRequest("recall-participant_events_join", {
      signingSecret: malformedSecret,
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("accepts webhook secrets without base64 padding", async () => {
    const unpaddedSecret = "whsec_cmVjYWxsLXRlc3Qtc2VjcmV0";
    const handler = vi.fn();
    const webhook = recall({ secret: unpaddedSecret }).event(
      participant_events_join,
      handler,
    );
    const request = createSignedRequest("recall-participant_events_join", {
      signingSecret: unpaddedSecret,
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects requests with signatures containing non-base64 characters", async () => {
    const webhook = recall({ secret }).event(participant_events_join, () => {});
    const request = createSignedRequest("recall-participant_events_join");
    request.headers["webhook-signature"] =
      `${request.headers["webhook-signature"]}!`;

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests with non-digit timestamps", async () => {
    const webhook = recall({ secret }).event(bot_joining_call, () => {});
    const request = createSignedRequest("recall-bot_joining_call", {
      timestamp: "not-a-timestamp",
      signature: "v1,ZmFrZQ==",
    });

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects timestamps with trailing characters", async () => {
    const webhookId = "msg_suffix";
    const validTimestamp = String(Math.floor(Date.now() / 1000));
    const request = createSignedRequest("recall-bot_joining_call", {
      webhookId,
      timestamp: `${validTimestamp}abc`,
      signature: `v1,${createRecallSignature({
        body: JSON.stringify(loadFixture("recall-bot_joining_call").body),
        signingSecret: secret,
        timestamp: `${validTimestamp}abc`,
        webhookId,
      })}`,
    });
    const webhook = recall({ secret }).event(bot_joining_call, () => {});

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects zero timestamps", async () => {
    const request = createSignedRequest("recall-bot_joining_call", {
      timestamp: "0",
      signature: `v1,${createRecallSignature({
        body: JSON.stringify(loadFixture("recall-bot_joining_call").body),
        signingSecret: secret,
        timestamp: "0",
        webhookId: "msg_123",
      })}`,
    });
    const webhook = recall({ secret }).event(bot_joining_call, () => {});

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects unsafe integer timestamps", async () => {
    const unsafeTimestamp = String(Number.MAX_SAFE_INTEGER + 1);
    const request = createSignedRequest("recall-bot_joining_call", {
      timestamp: unsafeTimestamp,
      signature: `v1,${createRecallSignature({
        body: JSON.stringify(loadFixture("recall-bot_joining_call").body),
        signingSecret: secret,
        timestamp: unsafeTimestamp,
        webhookId: "msg_123",
      })}`,
    });
    const webhook = recall({ secret }).event(bot_joining_call, () => {});

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("accepts rotated signatures in a single signature header", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const request = createSignedRequest("recall-bot_joining_call", {
      timestamp,
      signature: `v1,invalid-signature v1,${createRecallSignature({
        body: JSON.stringify(loadFixture("recall-bot_joining_call").body),
        signingSecret: secret,
        timestamp,
        webhookId: "msg_123",
      })}`,
    });
    const handler = vi.fn();
    const webhook = recall({ secret }).event(bot_joining_call, handler);

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects signature lists with no valid v1 entry", async () => {
    const request = createSignedRequest("recall-bot_joining_call", {
      signature: "v0,ZmFrZQ== v2,ZmFrZQ==",
    });
    const webhook = recall({ secret }).event(bot_joining_call, () => {});

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests with stale timestamps", async () => {
    const request = createSignedRequest("recall-bot_joining_call", {
      timestamp: String(Math.floor(Date.now() / 1000) - 60 * 10),
    });
    const webhook = recall({ secret }).event(bot_joining_call, () => {});

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("rejects requests with future timestamps outside tolerance", async () => {
    const request = createSignedRequest("recall-bot_joining_call", {
      timestamp: String(Math.floor(Date.now() / 1000) + 60 * 10),
    });
    const webhook = recall({ secret }).event(bot_joining_call, () => {});

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(401);
  });

  it("verifies requests when rawBody is a Buffer", async () => {
    const request = createSignedRequest("recall-transcript_data");
    const handler = vi.fn();
    const webhook = recall({ secret }).event(transcript_data, handler);

    const result = await webhook.process({
      headers: request.headers,
      rawBody: Buffer.from(request.rawBody, "utf-8"),
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![1].rawBody).toBe(request.rawBody);
  });

  it("uses RECALL_WEBHOOK_SECRET before WEBHOOK_SECRET", async () => {
    process.env.RECALL_WEBHOOK_SECRET = secret;
    process.env.WEBHOOK_SECRET = "whsec_d3Jvbmdfc2VjcmV0";
    const handler = vi.fn();
    const webhook = recall().event(participant_events_join, handler);
    const request = createSignedRequest("recall-participant_events_join");

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 204 for verified but unhandled events", async () => {
    const webhook = recall({ secret }).event(participant_events_join, () => {});
    const request = createSignedRequest("recall-transcript_data");

    const result = await webhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(result.status).toBe(204);
    expect(result.body).toBeUndefined();
  });

  it("supports replay protection and rejects duplicate deliveries", async () => {
    const store = createInMemoryReplayStore();
    const handler = vi.fn();
    const webhook = recall({ secret })
      .withReplayProtection({ store })
      .event(transcript_done, handler);
    const request = createSignedRequest("recall-transcript_done", {
      webhookId: "msg_duplicate",
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

  it("releases replay reservations for verified but unhandled events", async () => {
    const store = createInMemoryReplayStore();
    const request = createSignedRequest("recall-transcript_done", {
      webhookId: "msg_release",
    });

    const unhandledWebhook = recall({ secret }).withReplayProtection({ store });
    const unhandledResult = await unhandledWebhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });
    expect(unhandledResult.status).toBe(204);

    const handler = vi.fn();
    const handledWebhook = recall({ secret })
      .withReplayProtection({ store })
      .event(transcript_done, handler);
    const handledResult = await handledWebhook.process({
      headers: request.headers,
      rawBody: request.rawBody,
    });

    expect(handledResult.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
