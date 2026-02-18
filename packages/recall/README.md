# @better-webhook/recall

[![npm](https://img.shields.io/npm/v/@better-webhook/recall?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/recall)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/recall?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/recall)

Handle Recall.ai webhooks with type-safe payload validation and built-in request verification.

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
  transcript_data,
  bot_done,
} from "@better-webhook/recall/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = recall({
  secret: process.env.RECALL_WEBHOOK_SECRET,
})
  .event(participant_events_join, async (payload) => {
    console.log("participant joined:", payload.data.participant.name);
  })
  .event(transcript_data, async (payload) => {
    console.log("transcript words:", payload.data.words.length);
  })
  .event(bot_done, async (payload) => {
    console.log("bot status:", payload.data.code);
  });

export const POST = toNextJS(webhook);
```

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

## Signature Verification

Recall webhook verification is enabled by default. Provide a workspace secret with the `whsec_` prefix. The provider verifies:

- `webhook-id` / `svix-id`
- `webhook-timestamp` / `svix-timestamp`
- `webhook-signature` / `svix-signature`

using HMAC-SHA256 over `id.timestamp.rawBody`. Requests with stale timestamps are rejected to limit replay attacks.

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

## License

MIT
