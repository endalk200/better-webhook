import { Controller, Post, Get, Req, Res, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { github } from "@better-webhook/github";
import { ragie } from "@better-webhook/ragie";
import { toNestJS } from "@better-webhook/nestjs";

// Extend Request type to include rawBody
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller()
export class WebhooksController {
  // Create a GitHub webhook handler
  private githubWebhook = github()
    .event("push", async (payload, context) => {
      console.log("📦 Push event received!");
      console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
      console.log(`   Received at: ${context.receivedAt.toISOString()}`);
      console.log(`   Repository: ${payload.repository.full_name}`);
      console.log(`   Branch: ${payload.ref}`);
      console.log(`   Commits: ${payload.commits.length}`);
      payload.commits.forEach((commit) => {
        console.log(`   - ${commit.message} (${commit.id.slice(0, 7)})`);
      });
    })
    .event("pull_request", async (payload, context) => {
      console.log("🔀 Pull request event received!");
      console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
      console.log(`   Action: ${payload.action}`);
      console.log(
        `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
      );
      console.log(`   State: ${payload.pull_request.state}`);
    })
    .event("issues", async (payload, context) => {
      console.log("🎫 Issue event received!");
      console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
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

  // Create a Ragie webhook handler
  private ragieWebhook = ragie()
    .event("document_status_updated", async (payload, context) => {
      console.log("📄 Document status updated!");
      console.log(`   Delivery ID: ${context.headers["x-ragie-delivery"]}`);
      console.log(`   Document ID: ${payload.document_id}`);
      console.log(`   Status: ${payload.status}`);
      console.log(`   Partition: ${payload.partition}`);
    })
    .event("connection_sync_finished", async (payload, context) => {
      console.log("✅ Connection sync finished!");
      console.log(`   Delivery ID: ${context.headers["x-ragie-delivery"]}`);
      console.log(`   Connection ID: ${payload.connection_id}`);
      console.log(`   Sync ID: ${payload.sync_id}`);
      console.log(`   Partition: ${payload.partition}`);
    })
    .event("entity_extracted", async (payload, context) => {
      console.log("🔍 Entity extraction completed!");
      console.log(`   Delivery ID: ${context.headers["x-ragie-delivery"]}`);
      console.log(`   Document ID: ${payload.document_id}`);
      console.log(`   Partition: ${payload.partition || "default"}`);
    })
    .onError(async (error, context) => {
      console.error("❌ Ragie webhook error:", error.message);
      console.error("   Event type:", context.eventType);
    })
    .onVerificationFailed(async (reason) => {
      console.error("🔐 Ragie verification failed:", reason);
    });

  // Create the handlers with options
  private githubHandler = toNestJS(this.githubWebhook, {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed GitHub ${eventType} event`);
    },
  });

  private ragieHandler = toNestJS(this.ragieWebhook, {
    secret: process.env.RAGIE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Ragie ${eventType} event`);
    },
  });

  @Post("webhooks/github")
  async handleGitHubWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.githubHandler({
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
  getGitHubWebhookInfo(): object {
    return {
      status: "ok",
      endpoint: "/webhooks/github",
      supportedEvents: ["push", "pull_request", "issues"],
    };
  }

  @Post("webhooks/ragie")
  async handleRagieWebhook(
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.ragieHandler({
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

  @Get("webhooks/ragie")
  getRagieWebhookInfo(): object {
    return {
      status: "ok",
      endpoint: "/webhooks/ragie",
      supportedEvents: [
        "document_status_updated",
        "document_deleted",
        "entity_extracted",
        "connection_sync_started",
        "connection_sync_progress",
        "connection_sync_finished",
        "connection_limit_exceeded",
        "partition_limit_exceeded",
      ],
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
