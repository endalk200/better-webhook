# Express Example

A simple Express.js server demonstrating `@better-webhook/github`, `@better-webhook/ragie`, `@better-webhook/recall`, and `@better-webhook/express`.

## Quick Start

```bash
# From the repository root
pnpm install

# Run the example
pnpm --filter @better-webhook/express-example dev
```

## Configuration

Set environment variables to enable signature verification:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret \
RAGIE_WEBHOOK_SECRET=your-ragie-secret \
RECALL_WEBHOOK_SECRET=your-recall-whsec-secret \
pnpm --filter @better-webhook/express-example dev
```

## Endpoints

- `POST /webhooks/github` - GitHub webhook endpoint
- `POST /webhooks/ragie` - Ragie webhook endpoint
- `POST /webhooks/recall` - Recall.ai webhook endpoint
- `GET /health` - Health check

## Testing Locally

Without signature verification (for testing):

```bash
curl -X POST http://localhost:3001/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -d '{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
```

## Testing with Real GitHub Webhooks

1. Use [ngrok](https://ngrok.com/) to expose your local server:

   ```bash
   ngrok http 3001
   ```

2. Configure a webhook in your GitHub repository settings with the ngrok URL + `/webhooks/github`

3. Set the secret in both GitHub and your environment variable
