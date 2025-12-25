# NestJS Example

A simple NestJS app demonstrating `@better-webhook/github`, `@better-webhook/ragie`, and `@better-webhook/nestjs`.

## Quick Start

```bash
# From the repository root
pnpm install

# Run the example
pnpm --filter @better-webhook/nestjs-example dev
```

The app will be available at http://localhost:3003

## Configuration

Set environment variables to enable signature verification:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret \
RAGIE_WEBHOOK_SECRET=your-ragie-secret \
pnpm --filter @better-webhook/nestjs-example dev
```

## Endpoints

- `POST /webhooks/github` - GitHub webhook endpoint
- `GET /webhooks/github` - Returns GitHub endpoint info
- `POST /webhooks/ragie` - Ragie webhook endpoint
- `GET /webhooks/ragie` - Returns Ragie endpoint info
- `GET /health` - Health check

## Testing Locally

Without signature verification (for testing):

```bash
curl -X POST http://localhost:3003/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -d '{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
```

## Raw Body Configuration

This example uses NestJS's built-in raw body support. The `rawBody: true` option is set in `main.ts`:

```typescript
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  rawBody: true,
});
```

This ensures the raw request body is available for webhook signature verification.

## Project Structure

```
nestjs-example/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   └── webhooks.controller.ts
├── nest-cli.json
├── package.json
└── tsconfig.json
```
