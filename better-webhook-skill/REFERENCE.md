# Better Webhook SDK API Reference

## `@better-webhook/core`

The core package provides the builder, types, utilities, and re-exports `z` and `ZodSchema` from Zod.

### WebhookBuilder\<TProviderBrand\>

Immutable fluent builder. Every method returns a **new** builder instance.

```ts
import { WebhookBuilder } from "@better-webhook/core";
```

| Method                          | Signature                                                                          | Description                                           |
| ------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `event(event, handler)`         | `.event<E>(event: E, handler: EventHandler<InferEventPayload<E>>): WebhookBuilder` | Register a typed handler for a specific event         |
| `onError(handler)`              | `.onError(handler: ErrorHandler): WebhookBuilder`                                  | Register an error handler                             |
| `onVerificationFailed(handler)` | `.onVerificationFailed(handler: VerificationFailedHandler): WebhookBuilder`        | Register a verification failure handler               |
| `observe(observer)`             | `.observe(observer: WebhookObserver \| WebhookObserver[]): WebhookBuilder`         | Register lifecycle observer(s)                        |
| `withReplayProtection(options)` | `.withReplayProtection(options: ReplayProtectionOptions): WebhookBuilder`          | Enable replay/idempotency protection                  |
| `maxBodyBytes(bytes)`           | `.maxBodyBytes(bytes: number): WebhookBuilder`                                     | Set max request body size (returns 413 when exceeded) |
| `process(options)`              | `.process(options: ProcessOptions): Promise<ProcessResult>`                        | Process an incoming webhook (used by adapters)        |
| `getProvider()`                 | `.getProvider(): Provider<TProviderBrand>`                                         | Get the underlying provider                           |

### defineEvent()

Create a type-safe event definition for tree-shakeable imports.

```ts
import { defineEvent, z } from "@better-webhook/core";

const myEvent = defineEvent({
  name: "my_event",           // event name string
  schema: z.object({ ... }),  // Zod schema for payload validation
  provider: "my-provider" as const,  // provider brand (must use `as const`)
});
```

### customWebhook()

Create a custom webhook builder with inline provider configuration. Combines `createProvider()` + `new WebhookBuilder()`.

```ts
import { customWebhook, createHmacVerifier, z, defineEvent } from "@better-webhook/core";

const webhook = customWebhook({
  name: "my-provider",
  getEventType: (headers, body?) => headers["x-event-type"] ?? null,
  getDeliveryId: (headers) => headers["x-delivery-id"],          // optional
  verify: createHmacVerifier({ ... }),                            // required unless verification: "disabled"
  getPayload: (body) => body,                                     // optional, for envelope unwrapping
  getReplayContext: (headers, body?) => ({ replayKey: "..." }),   // optional
  verification: "required",                                       // "required" (default) | "disabled"
  secret: "optional-default-secret",                              // optional
});
```

### createProvider()

Create a `Provider` object without a builder (for advanced composition).

```ts
import { createProvider } from "@better-webhook/core";

const provider = createProvider({
  name: "my-provider",
  getEventType: (headers) => headers["x-event-type"],
  verify: createHmacVerifier({
    algorithm: "sha256",
    signatureHeader: "x-signature",
  }),
});

const webhook = new WebhookBuilder(provider);
```

### createHmacVerifier()

Create an HMAC verification function from options.

```ts
import { createHmacVerifier } from "@better-webhook/core";

const verify = createHmacVerifier({
  algorithm: "sha256", // "sha1" | "sha256" | "sha384" | "sha512"
  signatureHeader: "x-signature", // header containing the signature
  signaturePrefix: "sha256=", // optional prefix to strip before comparison
  signatureEncoding: "hex", // "hex" (default) | "base64"
});
// Returns: (rawBody, headers, secret) => boolean
```

### verifyHmac()

Low-level HMAC verification.

```ts
import { verifyHmac } from "@better-webhook/core";

const isValid = verifyHmac({
  algorithm: "sha256",
  rawBody: bodyString,
  secret: "my-secret",
  signature: headers["x-signature"],
  signaturePrefix: "sha256=", // optional
  signatureEncoding: "hex", // optional, default "hex"
});
```

### Replay Protection

```ts
import { createInMemoryReplayStore } from "@better-webhook/core";

const store = createInMemoryReplayStore({
  maxEntries: 10_000, // optional, max entries in memory
  cleanupIntervalMs: 60_000, // optional, sweep interval
  cleanupBatchSize: 128, // optional, entries removed per sweep
});

const webhook = github()
  .withReplayProtection({ store })
  // Or with custom policy:
  .withReplayProtection({
    store,
    policy: {
      ttlSeconds: 86400, // how long to remember processed keys
      inFlightTtlSeconds: 60, // reservation TTL during processing
      timestampToleranceSeconds: 300, // optional freshness window
      key: (ctx) => `${ctx.provider}:${ctx.replayKey}`, // build canonical key
      onDuplicate: "conflict", // "conflict" (409) | "ignore" (204)
    },
  });
```

**`AtomicReplayStore` interface** (implement for Redis, database, etc.):

```ts
interface AtomicReplayStore {
  reserve(
    key: string,
    inFlightTtlSeconds: number,
  ): Promise<"reserved" | "duplicate"> | "reserved" | "duplicate";
  commit(key: string, ttlSeconds: number): Promise<void> | void;
  release(key: string): Promise<void> | void;
}
```

### Observer / Stats

```ts
import { createWebhookStats, type WebhookObserver } from "@better-webhook/core";

// Built-in stats collector
const stats = createWebhookStats();
const webhook = github().observe(stats.observer).event(push, handler);
console.log(stats.snapshot());
// { totalRequests, successCount, errorCount, byProvider, byEventType, avgDurationMs }
stats.reset();

// Custom observer (all methods are optional)
const observer: WebhookObserver = {
  onRequestReceived: (event) => {
    /* provider, eventType?, rawBodyBytes, receivedAt */
  },
  onVerificationSucceeded: (event) => {
    /* verifyDurationMs */
  },
  onVerificationFailed: (event) => {
    /* verifyDurationMs, reason */
  },
  onSchemaValidationSucceeded: (event) => {
    /* validateDurationMs */
  },
  onSchemaValidationFailed: (event) => {
    /* validateDurationMs, error */
  },
  onHandlerStarted: (event) => {
    /* handlerIndex, handlerCount */
  },
  onHandlerSucceeded: (event) => {
    /* handlerIndex, handlerCount, handlerDurationMs */
  },
  onHandlerFailed: (event) => {
    /* handlerIndex, handlerCount, handlerDurationMs, error */
  },
  onEventUnhandled: (event) => {
    /* durationMs */
  },
  onBodyTooLarge: (event) => {
    /* maxBodyBytes */
  },
  onJsonParseFailed: (event) => {
    /* durationMs, error */
  },
  onReplaySkipped: (event) => {
    /* reason: "missing_key" */
  },
  onReplayFreshnessRejected: (event) => {
    /* timestamp, toleranceSeconds */
  },
  onReplayReserved: (event) => {
    /* replayKey, inFlightTtlSeconds */
  },
  onReplayDuplicate: (event) => {
    /* replayKey, behavior */
  },
  onReplayCommitted: (event) => {
    /* replayKey, ttlSeconds */
  },
  onReplayReleased: (event) => {
    /* replayKey, reason */
  },
  onCompleted: (event) => {
    /* status, durationMs, success */
  },
};
```

### Key Types

```ts
// Handler types
type EventHandler<T> = (
  payload: T,
  context: HandlerContext,
) => Promise<void> | void;
type ErrorHandler = (
  error: Error,
  context: ErrorContext,
) => Promise<void> | void;
type VerificationFailedHandler = (
  reason: string,
  headers: Headers,
) => Promise<void> | void;

// Context types
interface HandlerContext {
  eventType: string;
  provider: string;
  deliveryId?: string;
  headers: Headers;
  rawBody: string;
  receivedAt: Date;
}

interface ErrorContext {
  eventType: string;
  deliveryId?: string;
  payload: unknown;
}

// Processing types
interface ProcessResult {
  status: number; // HTTP status code (200, 204, 400, 401, 409, 413, 500)
  eventType?: string;
  body?: { ok: boolean; error?: string };
}

interface ProcessOptions {
  headers: Headers | Record<string, string | string[] | undefined>;
  rawBody: string | Buffer;
  secret?: string;
  maxBodyBytes?: number;
}

// Utility types
type Headers = Record<string, string | undefined>;
type HmacAlgorithm = "sha1" | "sha256" | "sha384" | "sha512";
```

### Utility Functions

```ts
import { normalizeHeaders, secureCompare } from "@better-webhook/core";

// Normalize headers to lowercase keys, with prototype pollution prevention
const headers = normalizeHeaders(req.headers);

// Constant-time string comparison
const isEqual = secureCompare(a, b);
```

---

## Provider Packages

### `@better-webhook/github`

```ts
import { github } from "@better-webhook/github";
import {
  push,
  pull_request,
  issues,
  installation,
  installation_repositories,
} from "@better-webhook/github/events";
```

**Factory:** `github(options?: { secret?: string }): WebhookBuilder<"github">`

**Verification:** HMAC-SHA256 via `x-hub-signature-256` header. Delivery ID from `x-github-delivery`.

| Event Export                | Event Name                    | Payload Type                          |
| --------------------------- | ----------------------------- | ------------------------------------- |
| `push`                      | `"push"`                      | `GitHubPushEvent`                     |
| `pull_request`              | `"pull_request"`              | `GitHubPullRequestEvent`              |
| `issues`                    | `"issues"`                    | `GitHubIssuesEvent`                   |
| `installation`              | `"installation"`              | `GitHubInstallationEvent`             |
| `installation_repositories` | `"installation_repositories"` | `GitHubInstallationRepositoriesEvent` |

### `@better-webhook/ragie`

```ts
import { ragie } from "@better-webhook/ragie";
import {
  document_status_updated,
  document_deleted,
  entity_extracted,
  connection_sync_started,
  connection_sync_progress,
  connection_sync_finished,
  connection_limit_exceeded,
  partition_limit_exceeded,
} from "@better-webhook/ragie/events";
```

**Factory:** `ragie(options?: { secret?: string }): WebhookBuilder<"ragie">`

**Verification:** HMAC-SHA256 via `x-signature` header. Event type extracted from body `type` field. Payload unwrapped from envelope `{ type, payload, nonce }`.

| Event Export                | Event Name                    | Payload Type                        |
| --------------------------- | ----------------------------- | ----------------------------------- |
| `document_status_updated`   | `"document_status_updated"`   | `RagieDocumentStatusUpdatedEvent`   |
| `document_deleted`          | `"document_deleted"`          | `RagieDocumentDeletedEvent`         |
| `entity_extracted`          | `"entity_extracted"`          | `RagieEntityExtractedEvent`         |
| `connection_sync_started`   | `"connection_sync_started"`   | `RagieConnectionSyncStartedEvent`   |
| `connection_sync_progress`  | `"connection_sync_progress"`  | `RagieConnectionSyncProgressEvent`  |
| `connection_sync_finished`  | `"connection_sync_finished"`  | `RagieConnectionSyncFinishedEvent`  |
| `connection_limit_exceeded` | `"connection_limit_exceeded"` | `RagieConnectionLimitExceededEvent` |
| `partition_limit_exceeded`  | `"partition_limit_exceeded"`  | `RagiePartitionLimitExceededEvent`  |

### `@better-webhook/recall`

```ts
import { recall } from "@better-webhook/recall";
import {
  bot_joining_call,
  transcript_data,
  participant_events_join,
} from "@better-webhook/recall/events";
```

**Factory:** `recall(options?: { secret?: string }): WebhookBuilder<"recall">`

**Verification:** Svix-style HMAC-SHA256 via `webhook-id`, `webhook-timestamp`, `webhook-signature` headers. Secret must have `whsec_` prefix. Event type from body `event` field. Payload unwrapped from `{ event, data }`. 5-minute timestamp tolerance.

| Event Export                         | Event Name                             | Payload Type                        |
| ------------------------------------ | -------------------------------------- | ----------------------------------- |
| `participant_events_join`            | `"participant_events.join"`            | `RecallParticipantEvent`            |
| `participant_events_leave`           | `"participant_events.leave"`           | `RecallParticipantEvent`            |
| `participant_events_update`          | `"participant_events.update"`          | `RecallParticipantEvent`            |
| `participant_events_speech_on`       | `"participant_events.speech_on"`       | `RecallParticipantEvent`            |
| `participant_events_speech_off`      | `"participant_events.speech_off"`      | `RecallParticipantEvent`            |
| `participant_events_webcam_on`       | `"participant_events.webcam_on"`       | `RecallParticipantEvent`            |
| `participant_events_webcam_off`      | `"participant_events.webcam_off"`      | `RecallParticipantEvent`            |
| `participant_events_screenshare_on`  | `"participant_events.screenshare_on"`  | `RecallParticipantEvent`            |
| `participant_events_screenshare_off` | `"participant_events.screenshare_off"` | `RecallParticipantEvent`            |
| `participant_events_chat_message`    | `"participant_events.chat_message"`    | `RecallParticipantChatMessageEvent` |
| `transcript_data`                    | `"transcript.data"`                    | `RecallTranscriptDataEvent`         |
| `transcript_partial_data`            | `"transcript.partial_data"`            | `RecallTranscriptPartialDataEvent`  |
| `bot_joining_call`                   | `"bot.joining_call"`                   | `RecallBotEvent`                    |
| `bot_in_waiting_room`                | `"bot.in_waiting_room"`                | `RecallBotEvent`                    |
| `bot_in_call_not_recording`          | `"bot.in_call_not_recording"`          | `RecallBotEvent`                    |
| `bot_recording_permission_allowed`   | `"bot.recording_permission_allowed"`   | `RecallBotEvent`                    |
| `bot_recording_permission_denied`    | `"bot.recording_permission_denied"`    | `RecallBotEvent`                    |
| `bot_in_call_recording`              | `"bot.in_call_recording"`              | `RecallBotEvent`                    |
| `bot_call_ended`                     | `"bot.call_ended"`                     | `RecallBotEvent`                    |
| `bot_done`                           | `"bot.done"`                           | `RecallBotEvent`                    |
| `bot_fatal`                          | `"bot.fatal"`                          | `RecallBotEvent`                    |
| `bot_breakout_room_entered`          | `"bot.breakout_room_entered"`          | `RecallBotEvent`                    |
| `bot_breakout_room_left`             | `"bot.breakout_room_left"`             | `RecallBotEvent`                    |
| `bot_breakout_room_opened`           | `"bot.breakout_room_opened"`           | `RecallBotEvent`                    |
| `bot_breakout_room_closed`           | `"bot.breakout_room_closed"`           | `RecallBotEvent`                    |

---

## Adapter Packages

All adapters share a common options pattern:

```ts
interface CommonAdapterOptions {
  secret?: string; // override provider secret
  maxBodyBytes?: number; // max body size (returns 413)
  onSuccess?: (eventType: string) => void; // called on status 200 only
  observer?: WebhookObserver | WebhookObserver[]; // lifecycle observers
}
```

### `@better-webhook/nextjs`

```ts
import { toNextJS } from "@better-webhook/nextjs";

// Returns: (request: Request) => Promise<Response>
export const POST = toNextJS(webhook, options?);
```

Use in Next.js App Router route files (`app/api/.../route.ts`). No special body parsing needed.

### `@better-webhook/express`

```ts
import { toExpress } from "@better-webhook/express";

// Returns: (req: Request, res: Response, next?: NextFunction) => Promise<void>
app.post("/webhooks/github",
  express.raw({ type: "application/json" }),  // REQUIRED: raw body middleware
  toExpress(webhook, options?)
);
```

**Critical:** Must use `express.raw({ type: "application/json" })` on the route for signature verification to work.

### `@better-webhook/hono`

```ts
import { toHono, toHonoNode } from "@better-webhook/hono";

// Standard Hono handler
app.post("/webhooks/github", toHono(webhook, options?));

// Node.js-specific convenience wrapper (identical behavior)
app.post("/webhooks/github", toHonoNode(webhook, options?));
```

### `@better-webhook/nestjs`

```ts
import { toNestJS, type NestJSResult } from "@better-webhook/nestjs";

// Returns: (req: NestJSRequest) => Promise<NestJSResult>
// NestJSResult: { statusCode: number; body?: Record<string, unknown> }
const handler = toNestJS(webhook, options?);
const result = await handler(req);
res.status(result.statusCode).json(result.body);
```

**Critical:** Enable raw body in `main.ts`: `NestFactory.create(AppModule, { rawBody: true })`

### `@better-webhook/gcp-functions`

```ts
import { toGCPFunction } from "@better-webhook/gcp-functions";

// 2nd Gen (Functions Framework)
import { http } from "@google-cloud/functions-framework";
http("webhookHandler", toGCPFunction(webhook, options?));

// 1st Gen (exports)
export const webhookHandler = toGCPFunction(webhook, options?);
```

Returns: `(req: GCPFunctionRequest, res: GCPFunctionResponse) => Promise<void>`
