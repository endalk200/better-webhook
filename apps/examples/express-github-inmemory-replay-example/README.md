# Express GitHub In-Memory Replay Example

An Express app showing GitHub replay protection with `createInMemoryReplayStore()`.

## Choose This Example If...

- you want the fastest local replay-protection demo
- you only need one provider and one route
- you want to watch a duplicate delivery return `409`

## What This Example Focuses On

- replay protection configured with `.withReplayProtection(...)`
- GitHub delivery ids as the replay key
- a process-local store that is easy to understand in one file

This example handles the GitHub `push` event.

## Quick Start

```bash
pnpm install
pnpm --filter @better-webhook/express-github-inmemory-replay-example dev
```

Server URL: `http://localhost:3003`

If you are running multiple examples at once, override `PORT`. `3003` is also used by `nestjs-example`.

## Configuration

Create your env vars before sending requests:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret
PORT=3003
```

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `PORT`                  | No       | Override the default port (`3003`)      |

## Endpoints

- `POST /webhooks/github` verifies the GitHub request, checks the replay store, and handles the event
- `GET /health` returns `{ status, timestamp }` so you can confirm the app is up

## Expected Behavior

Use one delivery id for the first request and reuse it for the duplicate.

```bash
SECRET="your-github-secret"
DELIVERY_ID="replay-demo-1"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Replay demo","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -i -X POST "http://localhost:3003/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: $DELIVERY_ID" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

Expected flow:

- the first request succeeds and logs `GitHub push accepted`
- the same request with the same `X-GitHub-Delivery` returns `409`
- changing `DELIVERY_ID` to a new value makes the request succeed again

## Limitations

The in-memory replay store is process-local.

- restarting the server clears replay history
- running multiple app instances does not share replay state
- this is great for local development and tests, not for durable production replay protection

## File Layout

- `src/index.ts` creates the app and mounts the GitHub route
- `src/webhooks/github.ts` configures GitHub verification and replay protection

## Canonical Docs

Use the main docs for broader replay/idempotency guidance:

- `apps/docs/content/docs/sdk/replay-idempotency.mdx`
- `apps/docs/content/docs/sdk/providers.mdx`

## Troubleshooting

- `401` usually means the configured secret does not match the sender.
- `409` on the second request is the expected duplicate behavior.
- Express must keep `express.raw({ type: "application/json" })` on the webhook route.
- Sign the exact raw payload bytes you send.
