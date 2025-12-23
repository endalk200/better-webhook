# @better-webhook/nestjs

**Type-safe webhooks for NestJS.**

Seamlessly integrate `better-webhook` into your NestJS application with full decorator and DI support.

```ts
import { Controller, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { github } from "@better-webhook/github";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github()
    .event("push", async (payload) => {
      console.log(`Push to ${payload.repository.name}`);
    });

  @Post("github")
  async handleGitHub(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}
```

## Features

- **🏗️ NestJS patterns** — Works with controllers, decorators, and DI
- **🔒 Automatic verification** — Signatures verified before your handler runs
- **📝 Type safe** — Full TypeScript support
- **⚙️ Raw body support** — Works with NestJS raw body option

## Installation

```bash
npm install @better-webhook/nestjs @better-webhook/core
# or
pnpm add @better-webhook/nestjs @better-webhook/core
# or
yarn add @better-webhook/nestjs @better-webhook/core
```

## Quick Start

### 1. Enable raw body parsing

Webhook signature verification requires the raw request body. Enable it in `main.ts`:

```ts
// main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body
  });
  await app.listen(3000);
}
bootstrap();
```

### 2. Install a provider

```bash
npm install @better-webhook/github
```

### 3. Create your controller

```ts
// webhooks.controller.ts
import { Controller, Post, Req, Res, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { github } from "@better-webhook/github";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github()
    .event("push", async (payload) => {
      const branch = payload.ref.replace("refs/heads/", "");
      console.log(`Push to ${branch}`);

      if (branch === "main") {
        await this.deployService.trigger();
      }
    })
    .event("pull_request", async (payload) => {
      if (payload.action === "opened") {
        await this.notificationService.sendSlack(
          `New PR: ${payload.pull_request.title}`
        );
      }
    });

  @Post("github")
  async handleGitHub(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}
```

### 4. Set your secret

```bash
export GITHUB_WEBHOOK_SECRET=your-secret-here
```

## Using Dependency Injection

Inject services into your webhook handlers:

```ts
import { Controller, Post, Req, Res, Injectable } from "@nestjs/common";
import { Response } from "express";
import { github } from "@better-webhook/github";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  constructor(
    private readonly deployService: DeployService,
    private readonly notificationService: NotificationService,
  ) {}

  // Create webhook in getter to access injected services
  private get webhook() {
    return github()
      .event("push", async (payload) => {
        if (payload.ref === "refs/heads/main") {
          // Use injected service
          await this.deployService.triggerDeployment({
            repo: payload.repository.full_name,
            commit: payload.after,
          });
        }
      })
      .event("pull_request", async (payload) => {
        if (payload.action === "merged") {
          await this.notificationService.notify(
            `PR #${payload.number} merged!`
          );
        }
      });
  }

  @Post("github")
  async handleGitHub(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}
```

## Multiple Webhook Providers

Handle different webhook sources in separate controller methods:

```ts
@Controller("webhooks")
export class WebhooksController {
  private githubWebhook = github()
    .event("push", async (payload) => {
      console.log("GitHub push:", payload.repository.name);
    });

  private stripeWebhook = customWebhook({
    name: "stripe",
    schemas: { "payment.succeeded": PaymentSchema },
    getEventType: (headers) => headers["stripe-event-type"],
  })
    .event("payment.succeeded", async (payload) => {
      console.log("Payment received:", payload.id);
    });

  @Post("github")
  async handleGitHub(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.githubWebhook)(req);
    return res.status(result.statusCode).json(result.body);
  }

  @Post("stripe")
  async handleStripe(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.stripeWebhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}
```

## Error Handling

### Handler Errors

Use built-in error hooks:

```ts
private webhook = github()
  .event("push", async (payload) => {
    await this.riskyOperation(payload);
  })
  .onError((error, context) => {
    this.logger.error(
      `Webhook error: ${context.eventType}`,
      error.stack,
    );
    
    // context.deliveryId is the X-GitHub-Delivery header
    this.errorTracker.capture(error, {
      eventType: context.eventType,
      deliveryId: context.deliveryId,
    });
  })
  .onVerificationFailed((reason, headers) => {
    this.logger.warn("Signature verification failed", { reason });
    this.securityService.alert("webhook_verification_failed", {
      reason,
      userAgent: headers["user-agent"],
    });
  });
```

### NestJS Exception Filters

Wrap in try-catch for NestJS exception handling:

```ts
@Post("github")
async handleGitHub(@Req() req: any, @Res() res: Response) {
  try {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    // Will be caught by NestJS exception filters
    throw new InternalServerErrorException("Webhook processing failed");
  }
}
```

## Configuration Options

### Custom Secret

```ts
@Post("github")
async handleGitHub(@Req() req: any, @Res() res: Response) {
  const result = await toNestJS(this.webhook, {
    secret: this.configService.get("GITHUB_SECRET"),
  })(req);
  return res.status(result.statusCode).json(result.body);
}
```

### Success Callback

```ts
@Post("github")
async handleGitHub(@Req() req: any, @Res() res: Response) {
  const result = await toNestJS(this.webhook, {
    onSuccess: async (eventType) => {
      this.metricsService.increment("webhook.success", {
        provider: "github",
        event: eventType,
      });
    },
  })(req);
  return res.status(result.statusCode).json(result.body);
}
```

## Response Codes

| Code | Meaning |
|------|---------|
| `200` | Webhook processed successfully |
| `204` | No handler registered for this event type |
| `400` | Invalid body or schema validation failed |
| `401` | Signature verification failed |
| `500` | Handler threw an error |

## Module Registration

Register your webhooks controller in a module:

```ts
// webhooks.module.ts
import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { DeployService } from "./deploy.service";
import { NotificationService } from "./notification.service";

@Module({
  controllers: [WebhooksController],
  providers: [DeployService, NotificationService],
})
export class WebhooksModule {}
```

## License

MIT
