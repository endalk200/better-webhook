# NestJS Example

A simple NestJS app demonstrating `@better-webhook/github`,
`@better-webhook/ragie`, `@better-webhook/recall`, and `@better-webhook/nestjs`.

## Quick Start

```bash
# From the repository root
pnpm install
pnpm --filter @better-webhook/nestjs-example dev
```

Server URL: `http://localhost:3003`

## Configuration

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `RAGIE_WEBHOOK_SECRET`  | Yes      | Secret used to verify Ragie signatures  |
| `RECALL_WEBHOOK_SECRET` | Yes      | Secret used to verify Recall signatures |

Example:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret \
RAGIE_WEBHOOK_SECRET=your-ragie-secret \
RECALL_WEBHOOK_SECRET=your-recall-whsec-secret \
pnpm --filter @better-webhook/nestjs-example dev
```

## Endpoints

- `POST /webhooks/github` - GitHub webhook endpoint
- `GET /webhooks/github` - GitHub endpoint info
- `POST /webhooks/ragie` - Ragie webhook endpoint
- `GET /webhooks/ragie` - Ragie endpoint info
- `POST /webhooks/recall` - Recall.ai webhook endpoint
- `GET /webhooks/recall` - Recall endpoint info
- `GET /health` - Health check
- `GET /stats` - In-memory webhook stats

## Signed Testing

Unsigned requests are rejected (`401`) because verification is required by
default. Sign test payloads with the same secret configured in your env vars.

```bash
SECRET="your-github-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -X POST "http://localhost:3003/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

For dev-only unsigned testing, use a custom provider configured with
`verification: "disabled"`. Do not use disabled verification in production.

## Replay Strategy Notes

This controller demonstrates manual in-memory dedupe on selected handlers:

- GitHub and Recall use `context.deliveryId`
- Ragie uses `payload.nonce` from the signed envelope

For production, use a shared replay store so duplicate detection works across
multiple instances.

For side-by-side examples of manual checks, `createInMemoryReplayStore`, and a
custom `ReplayStore`, see `apps/examples/nextjs-example/app/api/webhooks`.

## Troubleshooting

- `401` responses: verify secrets match the sender and your local env vars.
- Raw body support: keep `rawBody: true` in `main.ts`.
- `204` responses: expected for verified but unhandled event types.
- Replays after restart: expected with in-memory dedupe; switch to shared storage.
