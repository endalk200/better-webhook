# Hono Example

A simple Hono app demonstrating `@better-webhook/github`, `@better-webhook/ragie`, `@better-webhook/recall`, and `@better-webhook/hono`.

## Quick Start

```bash
# From the repository root
pnpm install

# Run the example
pnpm --filter @better-webhook/hono-example dev
```

The app will be available at `http://localhost:3004`

## Configuration

Set environment variables to enable signature verification:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret \
RAGIE_WEBHOOK_SECRET=your-ragie-secret \
RECALL_WEBHOOK_SECRET=your-recall-whsec-secret \
pnpm --filter @better-webhook/hono-example dev
```

Optional:

- `PORT` - Override the default port (`3004`)

## Endpoints

- `POST /webhooks/github` - GitHub webhook endpoint
- `POST /webhooks/ragie` - Ragie webhook endpoint
- `POST /webhooks/recall` - Recall.ai webhook endpoint
- `GET /health` - Health check
- `GET /stats` - In-memory webhook stats

## Testing Locally

Unsigned requests are rejected (`401`) because verification is required by
default. To test locally, sign the payload with the same secret:

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

## Raw Body Notes

Webhook signature verification depends on the original raw request body. Avoid
consuming `c.req.raw` directly before the adapter runs. If you need access to
the body in middleware, use Hono request helpers such as `c.req.text()` or
`c.req.arrayBuffer()` so the adapter can still reconstruct the payload.
