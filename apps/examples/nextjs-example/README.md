# Next.js Example

A Next.js App Router example showing the default route-per-provider setup for `@better-webhook/nextjs`.

## Choose This Example If...

- you want one route file per provider in App Router
- you want the clearest Next.js example in the repo
- you want to compare GitHub, Ragie, Stripe, Recall, and Resend in one app

## What It Demonstrates

- one `app/api/webhooks/.../route.ts` file per provider
- provider metadata via `GET` handlers on each route
- representative event handling for GitHub, Ragie, Stripe, Recall, and Resend

Representative events in this app:

- GitHub: `push`, `pull_request`, `issues`
- Ragie: `document_status_updated`, `connection_sync_finished`, `entity_extracted`
- Stripe: `charge.failed`, `checkout.session.completed`, `payment_intent.succeeded`
- Recall: `participant_events.join`, `participant_events.chat_message`, `transcript.data`, `bot.done`
- Resend: `email.delivered`, `email.bounced`, `email.received`, `domain.updated`, `contact.created`

## Quick Start

```bash
pnpm install
pnpm --filter @better-webhook/nextjs-example dev
```

Server URL: `http://localhost:3002`

The `dev` script is fixed to `next dev -p 3002`. If you need a different port, run a custom Next.js command instead of the package script.

## Configuration

Create your env vars before sending requests:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret
RAGIE_WEBHOOK_SECRET=your-ragie-secret
STRIPE_WEBHOOK_SECRET=your-stripe-secret
RECALL_WEBHOOK_SECRET=your-recall-secret
RESEND_WEBHOOK_SECRET=whsec_your-resend-secret-base64
```

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `STRIPE_WEBHOOK_SECRET` | Yes      | Secret used to verify Stripe signatures |
| `RAGIE_WEBHOOK_SECRET`  | Yes      | Secret used to verify Ragie signatures  |
| `RECALL_WEBHOOK_SECRET` | Yes      | Secret used to verify Recall signatures |
| `RESEND_WEBHOOK_SECRET` | Yes      | Secret used to verify Resend signatures |

## Endpoints

- `POST /api/webhooks/github` verifies and handles GitHub webhook events
- `GET /api/webhooks/github` returns `{ status, endpoint, supportedEvents }` for the GitHub route
- `POST /api/webhooks/ragie` verifies and handles Ragie webhook events
- `GET /api/webhooks/ragie` returns `{ status, endpoint, supportedEvents }` for the Ragie route
- `POST /api/webhooks/stripe` verifies and handles Stripe webhook events
- `GET /api/webhooks/stripe` returns `{ status, endpoint, supportedEvents }` for the Stripe route
- `POST /api/webhooks/recall` verifies and handles Recall webhook events
- `GET /api/webhooks/recall` returns `{ status, endpoint, supportedEvents }` for the Recall route
- `POST /api/webhooks/resend` verifies and handles Resend webhook events
- `GET /api/webhooks/resend` returns `{ status, endpoint, supportedEvents }` for the Resend route

There is no standalone `/health` route in this app. The `GET` route on each provider endpoint acts as the built-in status and metadata check.

## Try It

Send a signed GitHub `push` event:

```bash
SECRET="your-github-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -X POST "http://localhost:3002/api/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

Expected result:

- the request succeeds with a verified response
- the app logs `GitHub push received`
- the app logs `GitHub webhook processed`

Send a signed Resend `email.delivered` event:

```bash
SECRET="whsec_your-resend-secret-base64"
PAYLOAD='{"type":"email.delivered","created_at":"2024-11-22T23:41:12.126Z","data":{"email_id":"56761188-7520-42d8-8898-ff6fc54ce618","created_at":"2024-11-22T23:41:11.894719+00:00","from":"Acme <onboarding@resend.dev>","to":["delivered@resend.dev"],"subject":"Sending this example"}}'
MSG_ID="msg_test_123"
TIMESTAMP=$(date +%s)
SIGNATURE=$(node -e 'const crypto=require("node:crypto"); const [,secret,id,timestamp,payload]=process.argv; const key=Buffer.from(secret.slice("whsec_".length),"base64"); const sig=crypto.createHmac("sha256",key).update(`${id}.${timestamp}.${payload}`).digest("base64"); process.stdout.write(sig);' "$SECRET" "$MSG_ID" "$TIMESTAMP" "$PAYLOAD")

curl -X POST "http://localhost:3002/api/webhooks/resend" \
  -H "Content-Type: application/json" \
  -H "svix-id: $MSG_ID" \
  -H "svix-timestamp: $TIMESTAMP" \
  -H "svix-signature: v1,$SIGNATURE" \
  -d "$PAYLOAD"
```

Expected result:

- the request succeeds with a verified response
- the app logs `Resend email delivered`
- the app logs `Resend webhook processed`

## File Layout

- `app/api/webhooks/github/route.ts` handles GitHub events
- `app/api/webhooks/ragie/route.ts` handles Ragie events
- `app/api/webhooks/stripe/route.ts` handles Stripe events
- `app/api/webhooks/recall/route.ts` handles Recall events
- `app/api/webhooks/resend/route.ts` handles Resend events

## Recall Note

The Recall route shows the intended import story:

- `recall` from `@better-webhook/recall`
- event constants from `@better-webhook/recall/events`

Handlers receive unwrapped `body.data`, but nested properties such as `payload.data.participant` still come from Recall's event payload schema.

## Advanced Topics

This app keeps the default routes minimal and easy to read. For replay protection and telemetry, use the canonical SDK docs:

- `apps/docs/content/docs/sdk/providers.mdx`
- `apps/docs/content/docs/sdk/replay-idempotency.mdx`
- `apps/docs/content/docs/sdk/opentelemetry.mdx`

## Troubleshooting

- `401` usually means the configured secret does not match the sender.
- Sign the exact raw payload bytes you send.
- `200` or `204` can both be valid for verified requests depending on provider behavior.
