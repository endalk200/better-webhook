import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Enable raw body for webhook signature verification
    rawBody: true,
  });

  const port = process.env.PORT || 3003;
  await app.listen(port);

  console.log(`
🚀 NestJS webhook server running!
   
   Webhook endpoint: http://localhost:${port}/webhooks/github
   Health check:     http://localhost:${port}/health

   To test with ngrok:
   1. ngrok http ${port}
   2. Configure GitHub webhook with the ngrok URL + /webhooks/github
   3. Set GITHUB_WEBHOOK_SECRET environment variable

   Or test locally with curl:
   curl -X POST http://localhost:${port}/webhooks/github \\
     -H "Content-Type: application/json" \\
     -H "X-GitHub-Event: push" \\
     -H "X-GitHub-Delivery: test-123" \\
     -d '{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
  `);
}

bootstrap();
