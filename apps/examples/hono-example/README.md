# Hono Example

A simple Hono app demonstrating `@better-webhook/github`,
`@better-webhook/ragie`, `@better-webhook/recall`, and `@better-webhook/hono`.

## Quick Start

```bash
# From the repository root
pnpm install
pnpm --filter @better-webhook/hono-example dev
```

Server URL: `http://localhost:3004`

## Configuration

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `RAGIE_WEBHOOK_SECRET`  | Yes      | Secret used to verify Ragie signatures  |
| `RECALL_WEBHOOK_SECRET` | Yes      | Secret used to verify Recall signatures |
| `PORT`                  | No       | Override the default port (`3004`)      |

Example:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret \
RAGIE_WEBHOOK_SECRET=your-ragie-secret \
RECALL_WEBHOOK_SECRET=your-recall-whsec-secret \
pnpm --filter @better-webhook/hono-example dev
```

## Endpoints

- `POST /webhooks/github` - GitHub webhook endpoint
- `POST /webhooks/ragie` - Ragie webhook endpoint
- `POST /webhooks/recall` - Recall.ai webhook endpoint
- `GET /health` - Health check
- `GET /stats` - In-memory webhook stats

## Signed Testing

Unsigned requests are rejected (`401`) because verification is required by
default. Sign test payloads with the same secret configured in your env vars.

```bash
SECRET="your-github-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -X POST "http://localhost:3004/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

For dev-only unsigned testing, use a custom provider configured with
`verification: "disabled"`. Do not use disabled verification in production.

## Replay Strategy Notes

This example demonstrates manual in-memory dedupe on selected handlers:

- GitHub and Recall use `context.deliveryId`
- Ragie uses `payload.nonce` from the signed envelope

For production, use a shared replay store so duplicate detection works across
multiple instances.

For side-by-side examples of manual checks, `createInMemoryReplayStore`, and a
custom `ReplayStore`, see `apps/examples/nextjs-example/app/api/webhooks`.

## Troubleshooting

- `401` responses: verify secrets match the sender and your local env vars.
- Signature mismatch: sign the exact raw payload bytes sent in `curl`.
- Raw body handling: avoid consuming `c.req.raw` before the adapter runs.
- Replays after restart: expected with in-memory dedupe; switch to shared storage.
