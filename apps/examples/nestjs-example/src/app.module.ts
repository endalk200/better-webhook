import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller.js";

@Module({
  controllers: [WebhooksController],
})
export class AppModule {}
