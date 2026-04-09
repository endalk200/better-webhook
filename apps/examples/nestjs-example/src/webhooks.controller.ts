import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { githubHandler, githubInfo } from "./webhooks/github.webhook.js";
import { ragieHandler, ragieInfo } from "./webhooks/ragie.webhook.js";
import { recallHandler, recallInfo } from "./webhooks/recall.webhook.js";
import { stripeHandler, stripeInfo } from "./webhooks/stripe.webhook.js";
import type { RawBodyRequest } from "./webhooks/types.js";

@Controller()
export class WebhooksController {
  @Post("webhooks/github")
  async handleGitHubWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    await githubHandler(req, res);
  }

  @Get("webhooks/github")
  getGitHubWebhookInfo(): object {
    return githubInfo;
  }

  @Post("webhooks/ragie")
  async handleRagieWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    await ragieHandler(req, res);
  }

  @Get("webhooks/ragie")
  getRagieWebhookInfo(): object {
    return ragieInfo;
  }

  @Post("webhooks/stripe")
  async handleStripeWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    await stripeHandler(req, res);
  }

  @Get("webhooks/stripe")
  getStripeWebhookInfo(): object {
    return stripeInfo;
  }

  @Post("webhooks/recall")
  async handleRecallWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    await recallHandler(req, res);
  }

  @Get("webhooks/recall")
  getRecallWebhookInfo(): object {
    return recallInfo;
  }

  @Get("health")
  healthCheck(): object {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
