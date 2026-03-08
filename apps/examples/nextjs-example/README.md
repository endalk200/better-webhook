# Next.js Example

A simple Next.js app demonstrating `@better-webhook/github`,
`@better-webhook/stripe`, `@better-webhook/ragie`,
`@better-webhook/recall`, `@better-webhook/resend`, and
`@better-webhook/nextjs`.

## Quick Start

```bash
# From the repository root
pnpm install
pnpm --filter @better-webhook/nextjs-example dev
```

Server URL: `http://localhost:3002`

## Configuration

| Variable                | Required | Description                                           |
| ----------------------- | -------- | ----------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures               |
| `STRIPE_WEBHOOK_SECRET` | Yes      | Secret used to verify Stripe signatures               |
| `RAGIE_WEBHOOK_SECRET`  | Yes      | Secret used to verify Ragie signatures                |
| `RECALL_WEBHOOK_SECRET` | Yes      | Secret used to verify Recall signatures (`whsec_...`) |
| `RESEND_WEBHOOK_SECRET` | Yes      | Secret used to verify Resend Svix signatures          |

Example:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret \
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-secret \
RAGIE_WEBHOOK_SECRET=your-ragie-secret \
RECALL_WEBHOOK_SECRET=whsec_your-recall-secret-base64 \
RESEND_WEBHOOK_SECRET=whsec_your-resend-secret-base64 \
pnpm --filter @better-webhook/nextjs-example dev
```

Or create a `.env.local` file:

```env
GITHUB_WEBHOOK_SECRET=your-github-secret
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-secret
RAGIE_WEBHOOK_SECRET=your-ragie-secret
RECALL_WEBHOOK_SECRET=whsec_your-recall-secret-base64
RESEND_WEBHOOK_SECRET=whsec_your-resend-secret-base64
```

## Endpoints

- `POST /api/webhooks/github` - GitHub webhook endpoint
- `GET /api/webhooks/github` - GitHub endpoint info
- `POST /api/webhooks/ragie` - Ragie webhook endpoint
- `GET /api/webhooks/ragie` - Ragie endpoint info
- `POST /api/webhooks/stripe` - Stripe webhook endpoint
- `GET /api/webhooks/stripe` - Stripe endpoint info
- `POST /api/webhooks/recall` - Recall.ai webhook endpoint
- `GET /api/webhooks/recall` - Recall endpoint info
- `POST /api/webhooks/resend` - Resend webhook endpoint
- `GET /api/webhooks/resend` - Resend endpoint info

## Signed Testing

Unsigned requests are rejected (`401`) because verification is required by
default. Sign test payloads with the same secret configured in your env vars.

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

For Resend, sign the Svix-style payload using the `whsec_...` secret:

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

For dev-only unsigned testing, use a custom provider configured with
`verification: "disabled"`. Do not use disabled verification in production.

## Replay Strategy Notes

This example demonstrates several replay/idempotency strategies:

- Built-in replay store (`github` route) via `createInMemoryReplayStore()`
- Built-in replay store (`stripe` route) via provider event ids
- Built-in replay store (`resend` route) via `svix-id`
- Custom replay store (`ragie` route) using provider replay metadata (`nonce`)
- Manual dedupe (`recall` route) using `context.deliveryId`

For production, use a shared persistent store (for example Redis) so replay
state survives restarts and works across instances. Use atomic reservation
semantics (`reserve/commit/release`) for custom stores.

## Troubleshooting

- `401` responses: verify secrets match the sender and your local env vars.
- Signature mismatch: sign the exact raw payload bytes sent in `curl`.
- `200`/`204` responses: verified requests may be acknowledged even when no handler is registered, depending on provider contract.
- Duplicate events: check replay strategy and storage persistence.
