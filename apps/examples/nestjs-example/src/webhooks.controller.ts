import { Controller, Post, Get, Req, Res, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { github } from "@better-webhook/github";
import { toNestJS } from "@better-webhook/nestjs";

// Extend Request type to include rawBody
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller()
export class WebhooksController {
  // Create a GitHub webhook handler
  private webhook = github()
    .event("push", async (payload) => {
      console.log("📦 Push event received!");
      console.log(`   Repository: ${payload.repository.full_name}`);
      console.log(`   Branch: ${payload.ref}`);
      console.log(`   Commits: ${payload.commits.length}`);
      payload.commits.forEach((commit) => {
        console.log(`   - ${commit.message} (${commit.id.slice(0, 7)})`);
      });
    })
    .event("pull_request", async (payload) => {
      console.log("🔀 Pull request event received!");
      console.log(`   Action: ${payload.action}`);
      console.log(
        `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
      );
      console.log(`   State: ${payload.pull_request.state}`);
    })
    .event("issues", async (payload) => {
      console.log("🎫 Issue event received!");
      console.log(`   Action: ${payload.action}`);
      console.log(`   Issue #${payload.issue.number}: ${payload.issue.title}`);
      console.log(`   State: ${payload.issue.state}`);
    })
    .onError(async (error, context) => {
      console.error("❌ Webhook error:", error.message);
      console.error("   Event type:", context.eventType);
    })
    .onVerificationFailed(async (reason) => {
      console.error("🔐 Verification failed:", reason);
    });

  // Create the handler with options
  private handler = toNestJS(this.webhook, {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed ${eventType} event`);
    },
  });

  @Post("webhooks/github")
  async handleGitHubWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.handler({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
      rawBody: req.rawBody,
    });

    if (result.body) {
      res.status(result.statusCode).json(result.body);
    } else {
      res.status(result.statusCode).end();
    }
  }

  @Get("webhooks/github")
  getWebhookInfo(): object {
    return {
      status: "ok",
      endpoint: "/webhooks/github",
      supportedEvents: ["push", "pull_request", "issues"],
    };
  }

  @Get("health")
  healthCheck(): object {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
