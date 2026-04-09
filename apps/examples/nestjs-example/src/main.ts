import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const port = Number(process.env.PORT ?? "3003");
  await app.listen(port);

  console.log(`NestJS example listening on http://localhost:${port}`);
  console.log("Endpoints:");
  console.log(`- POST http://localhost:${port}/webhooks/github`);
  console.log(`- POST http://localhost:${port}/webhooks/ragie`);
  console.log(`- POST http://localhost:${port}/webhooks/stripe`);
  console.log(`- POST http://localhost:${port}/webhooks/recall`);
  console.log(`- GET  http://localhost:${port}/health`);
  console.log(
    "Reminder: keep Nest raw body enabled for signature verification.",
  );
}

bootstrap();
