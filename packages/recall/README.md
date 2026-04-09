# @better-webhook/recall

[![npm](https://img.shields.io/npm/v/@better-webhook/recall?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/recall)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/recall?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/recall)

Handle Recall.ai webhooks with type-safe payload validation and built-in request verification.

This package focuses on Recall webhook delivery. It does not currently model
Recall websocket-only realtime media streams.

## Installation

```bash
npm install @better-webhook/recall @better-webhook/core
# or
pnpm add @better-webhook/recall @better-webhook/core
# or
yarn add @better-webhook/recall @better-webhook/core
```

Install one adapter package too:

```bash
# Pick one:
npm install @better-webhook/nextjs        # Next.js App Router
npm install @better-webhook/express       # Express.js
npm install @better-webhook/nestjs        # NestJS
npm install @better-webhook/hono          # Hono (Node/Workers/Bun/Deno)
npm install @better-webhook/gcp-functions # GCP Cloud Functions
```

## Quick Start

```ts
import { recall } from "@better-webhook/recall";
import {
  participant_events_join,
  participant_events_chat_message,
  transcript_data,
  bot_done,
} from "@better-webhook/recall/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = recall({
  secret: process.env.RECALL_WEBHOOK_SECRET,
})
  .event(participant_events_join, async (payload) => {
    const participantEvent = payload.data;

    console.log("participant joined:", participantEvent.participant.name);
  })
  .event(participant_events_chat_message, async (payload) => {
    const participantEvent = payload.data;
    const message = participantEvent.data;

    console.log("message from:", participantEvent.participant.name);
    console.log("message text:", message.text);
  })
  .event(transcript_data, async (payload) => {
    const transcript = payload.data;

    console.log("transcript words:", transcript.words.length);
  })
  .event(bot_done, async (payload) => {
    const botStatus = payload.data;

    console.log("bot status:", botStatus.code);
  });

export const POST = toNextJS(webhook);
```

## Handler Payload Shape

Recall sends webhook bodies shaped like this:

```json
{
  "event": "participant_events.join",
  "data": {
    "data": {
      "participant": {
        "id": "participant_123",
        "name": "Ada Lovelace"
      }
    }
  }
}
```

The SDK uses `body.event` for dispatch and passes the unwrapped `body.data` object to your handler as `payload`.

That means these names line up like this:

- `body.event` -> event name used for routing
- `body.data` -> handler `payload`
- `payload.data` -> Recall's nested event-specific data object

This is why Recall handlers often read fields such as `payload.data.participant.name`, `payload.data.words.length`, or `payload.data.code`.

## Supported Events

### Participant Events

- `participant_events_join` (`participant_events.join`)
- `participant_events_leave` (`participant_events.leave`)
- `participant_events_update` (`participant_events.update`)
- `participant_events_speech_on` (`participant_events.speech_on`)
- `participant_events_speech_off` (`participant_events.speech_off`)
- `participant_events_webcam_on` (`participant_events.webcam_on`)
- `participant_events_webcam_off` (`participant_events.webcam_off`)
- `participant_events_screenshare_on` (`participant_events.screenshare_on`)
- `participant_events_screenshare_off` (`participant_events.screenshare_off`)
- `participant_events_chat_message` (`participant_events.chat_message`)

### Transcript Events

- `transcript_data` (`transcript.data`)
- `transcript_partial_data` (`transcript.partial_data`)
- `transcript_provider_data` (`transcript.provider_data`)

### Recording Events

- `recording_processing` (`recording.processing`)
- `recording_done` (`recording.done`)
- `recording_failed` (`recording.failed`)
- `recording_deleted` (`recording.deleted`)

### Transcript Artifact Events

- `transcript_processing` (`transcript.processing`)
- `transcript_done` (`transcript.done`)
- `transcript_failed` (`transcript.failed`)
- `transcript_deleted` (`transcript.deleted`)

### Participant Events Artifact Events

- `participant_events_processing` (`participant_events.processing`)
- `participant_events_done` (`participant_events.done`)
- `participant_events_failed` (`participant_events.failed`)
- `participant_events_deleted` (`participant_events.deleted`)

### Bot Events

- `bot_joining_call` (`bot.joining_call`)
- `bot_in_waiting_room` (`bot.in_waiting_room`)
- `bot_in_call_not_recording` (`bot.in_call_not_recording`)
- `bot_recording_permission_allowed` (`bot.recording_permission_allowed`)
- `bot_recording_permission_denied` (`bot.recording_permission_denied`)
- `bot_in_call_recording` (`bot.in_call_recording`)
- `bot_call_ended` (`bot.call_ended`)
- `bot_done` (`bot.done`)
- `bot_fatal` (`bot.fatal`)
- `bot_breakout_room_entered` (`bot.breakout_room_entered`)
- `bot_breakout_room_left` (`bot.breakout_room_left`)
- `bot_breakout_room_opened` (`bot.breakout_room_opened`)
- `bot_breakout_room_closed` (`bot.breakout_room_closed`)

### Calendar V2 Events

- `calendar_update` (`calendar.update`)
- `calendar_sync_events` (`calendar.sync_events`)

### Desktop SDK Upload Events

- `sdk_upload_recording_started` (`sdk_upload.recording_started`)
- `sdk_upload_recording_ended` (`sdk_upload.recording_ended`)
- `sdk_upload_complete` (`sdk_upload.complete`)
- `sdk_upload_failed` (`sdk_upload.failed`)

## Signature Verification

Recall webhook verification is enabled by default. Provide a workspace secret with the `whsec_` prefix. The provider verifies:

- `webhook-id` / `svix-id`
- `webhook-timestamp` / `svix-timestamp`
- `webhook-signature` / `svix-signature`

using HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`. Requests with stale timestamps are rejected to limit replay attacks.

If both `webhook-*` and `svix-*` headers are present for the same field, the
values must match. Mismatched aliased headers are rejected.

The request must be verified against the exact raw request bytes. Frameworks
that parse and then re-stringify JSON can break verification.

Secrets resolve in this order:

1. explicit adapter or `.process()` secret
2. `recall({ secret })`
3. `RECALL_WEBHOOK_SECRET`
4. `WEBHOOK_SECRET`

Handler payloads receive the unwrapped Recall `body.data` object, not the full
`{ event, data }` envelope.

## Replay Protection and Idempotency

Recall exposes the delivery identifier as `context.deliveryId` from
`webhook-id`/`svix-id`. The SDK also validates request timestamps, but duplicate
delivery blocking is enforced only when replay protection is enabled:

```ts
import { createInMemoryReplayStore } from "@better-webhook/core";

const webhook = recall({ secret: process.env.RECALL_WEBHOOK_SECRET })
  .withReplayProtection({
    store: createInMemoryReplayStore(),
  })
  .event(bot_done, async (payload) => {
    await handleBotDone(payload);
  });
```

With replay protection enabled, duplicate deliveries return `409` by default.
The provider already validates signed timestamps during verification; you can
also configure core `timestampToleranceSeconds` as an additional replay guard.
For production deduplication, use a shared replay store with atomic reservation
semantics (`reserve/commit/release`).

Verified but unhandled Recall webhook events return `204`.

## License

MIT
