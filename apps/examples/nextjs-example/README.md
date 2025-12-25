# Next.js Example

A simple Next.js app demonstrating `@better-webhook/github` and `@better-webhook/nextjs`.

## Quick Start

```bash
# From the repository root
pnpm install

# Run the example
pnpm --filter @better-webhook/nextjs-example dev
```

The app will be available at http://localhost:3002

## Configuration

Set the `GITHUB_WEBHOOK_SECRET` environment variable to enable signature verification:

```bash
GITHUB_WEBHOOK_SECRET=your-secret pnpm --filter @better-webhook/nextjs-example dev
```

Or create a `.env.local` file:

```env
GITHUB_WEBHOOK_SECRET=your-secret
```

## Endpoints

- `POST /api/webhooks/github` - GitHub webhook endpoint
- `GET /api/webhooks/github` - Returns endpoint info

## Testing Locally

Without signature verification (for testing):

```bash
curl -X POST http://localhost:3002/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -d '{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
```

## Project Structure

```
nextjs-example/
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── github/
│   │           └── route.ts  # Webhook handler
│   ├── layout.tsx
│   └── page.tsx
├── next.config.js
├── package.json
└── tsconfig.json
```
