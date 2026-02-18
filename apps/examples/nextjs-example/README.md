# Next.js Example

A simple Next.js app demonstrating `@better-webhook/github`,
`@better-webhook/ragie`, `@better-webhook/recall`, and `@better-webhook/nextjs`.

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
| `RAGIE_WEBHOOK_SECRET`  | Yes      | Secret used to verify Ragie signatures                |
| `RECALL_WEBHOOK_SECRET` | Yes      | Secret used to verify Recall signatures (`whsec_...`) |

Example:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret \
RAGIE_WEBHOOK_SECRET=your-ragie-secret \
RECALL_WEBHOOK_SECRET=whsec_your-recall-secret-base64 \
pnpm --filter @better-webhook/nextjs-example dev
```

Or create a `.env.local` file:

```env
GITHUB_WEBHOOK_SECRET=your-github-secret
RAGIE_WEBHOOK_SECRET=your-ragie-secret
RECALL_WEBHOOK_SECRET=whsec_your-recall-secret-base64
```

## Endpoints

- `POST /api/webhooks/github` - GitHub webhook endpoint
- `GET /api/webhooks/github` - GitHub endpoint info
- `POST /api/webhooks/ragie` - Ragie webhook endpoint
- `GET /api/webhooks/ragie` - Ragie endpoint info
- `POST /api/webhooks/recall` - Recall.ai webhook endpoint
- `GET /api/webhooks/recall` - Recall endpoint info

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

For dev-only unsigned testing, use a custom provider configured with
`verification: "disabled"`. Do not use disabled verification in production.

## Replay Strategy Notes

This example demonstrates three replay/idempotency strategies:

- Built-in replay store (`github` route) via `createInMemoryReplayStore()`
- Custom replay store (`ragie` route) using provider replay metadata (`nonce`)
- Manual dedupe (`recall` route) using `context.deliveryId`

For production, use a shared persistent store (for example Redis) so replay
state survives restarts and works across instances. Use atomic reservation
semantics (`reserve/commit/release`) for custom stores.

## Troubleshooting

- `401` responses: verify secrets match the sender and your local env vars.
- Signature mismatch: sign the exact raw payload bytes sent in `curl`.
- `204` responses: expected for verified but unhandled event types.
- Duplicate events: check replay strategy and storage persistence.
