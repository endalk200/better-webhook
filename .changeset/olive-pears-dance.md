"@better-webhook/core": minor
"@better-webhook/express": minor
"@better-webhook/hono": minor
"@better-webhook/nextjs": minor
"@better-webhook/nestjs": minor
"@better-webhook/gcp-functions": minor
---

Add an opt-in request body size guard for webhook processing.

Adapters now accept `maxBodyBytes` and pass it to core processing. When the
request body exceeds the configured limit, processing returns `413` with
`Payload too large`, emits a new `onBodyTooLarge` observability event, and
still emits `onCompleted` with status `413`.

This change is non-breaking and disabled by default unless `maxBodyBytes` is
configured via adapter options, `process()` options, or `WebhookBuilder.maxBodyBytes()`.
