# @better-webhook/github

[![npm](https://img.shields.io/npm/v/@better-webhook/github?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/github)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/github?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/github)

**Handle GitHub webhooks with full type safety.**

No more guessing payload shapes. No more manual signature verification. Just beautiful, typed webhook handlers.

```ts
import { github } from "@better-webhook/github";

const webhook = github().event("push", async (payload) => {
  // ✨ Full autocomplete for payload.repository, payload.commits, etc.
  console.log(
    `${payload.pusher.name} pushed ${payload.commits.length} commits`,
  );
});
```

## Features

- **🔒 Automatic signature verification** — HMAC-SHA256 verification using `x-hub-signature-256`
- **📝 Fully typed payloads** — TypeScript knows every field on every event
- **✅ Schema validated** — Malformed payloads are caught and rejected
- **🎯 Multiple events** — Handle `push`, `pull_request`, `issues`, and more

## Installation

```bash
npm install @better-webhook/github @better-webhook/core
# or
pnpm add @better-webhook/github @better-webhook/core
# or
yarn add @better-webhook/github @better-webhook/core
```

You'll also need a framework adapter:

```bash
# Pick one:
npm install @better-webhook/nextjs   # Next.js App Router
npm install @better-webhook/express  # Express.js
npm install @better-webhook/nestjs   # NestJS
```

## Quick Start

### Next.js

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github().event("push", async (payload) => {
  console.log(`Push to ${payload.repository.full_name}`);

  for (const commit of payload.commits) {
    console.log(`- ${commit.message} by ${commit.author.name}`);
  }
});

export const POST = toNextJS(webhook);
```

### Express

```ts
import express from "express";
import { github } from "@better-webhook/github";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github().event("push", async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);

app.listen(3000);
```

### NestJS

```ts
import { Controller, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { github } from "@better-webhook/github";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github().event("push", async (payload) => {
    console.log(`Push to ${payload.repository.name}`);
  });

  @Post("github")
  async handleGitHub(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}
```

## Supported Events

| Event                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `push`                      | Push to a repository                                 |
| `pull_request`              | Pull request opened, closed, merged, etc.            |
| `issues`                    | Issue opened, closed, labeled, etc.                  |
| `installation`              | GitHub App installed, uninstalled, or suspended      |
| `installation_repositories` | Repositories added/removed from a GitHub App install |

> More events coming soon! PRs welcome.

## Event Examples

### Push Events

```ts
github().event("push", async (payload) => {
  // Branch info
  const branch = payload.ref.replace("refs/heads/", "");
  console.log(`Push to ${branch}`);

  // Commit details
  for (const commit of payload.commits) {
    console.log(`${commit.id.slice(0, 7)}: ${commit.message}`);
    console.log(`  Author: ${commit.author.name} <${commit.author.email}>`);
    console.log(
      `  Files: +${commit.added?.length || 0} ~${commit.modified?.length || 0} -${commit.removed?.length || 0}`,
    );
  }

  // Force push detection
  if (payload.forced) {
    console.warn("⚠️ Force push detected!");
  }
});
```

### Pull Request Events

```ts
github().event("pull_request", async (payload) => {
  const pr = payload.pull_request;

  switch (payload.action) {
    case "opened":
      console.log(`New PR #${pr.number}: ${pr.title}`);
      console.log(`From: ${pr.head.ref} → ${pr.base.ref}`);
      await notifySlack(`New PR: ${pr.title}`);
      break;

    case "closed":
      if (pr.merged_at) {
        console.log(`PR #${pr.number} merged!`);
        await triggerDeployment(pr.base.ref);
      } else {
        console.log(`PR #${pr.number} closed without merging`);
      }
      break;
  }
});
```

### Issue Events

```ts
github().event("issues", async (payload) => {
  const issue = payload.issue;

  if (payload.action === "opened") {
    console.log(`New issue #${issue.number}: ${issue.title}`);

    // Auto-label based on title
    if (issue.title.toLowerCase().includes("bug")) {
      await addLabel(issue.number, "bug");
    }
  }

  if (payload.action === "labeled") {
    const labels = issue.labels.map((l) => l.name);
    if (labels.includes("urgent")) {
      await notifyOnCall(issue);
    }
  }
});
```

### Installation Events (GitHub Apps)

```ts
github().event("installation", async (payload) => {
  const installation = payload.installation;

  switch (payload.action) {
    case "created":
      console.log(`App installed on ${installation.account.login}`);
      // Store installation ID for API access
      await db.installations.insert({
        id: installation.id,
        account: installation.account.login,
        targetType: installation.target_type,
      });
      break;

    case "deleted":
      console.log(`App uninstalled from ${installation.account.login}`);
      await db.installations.delete(installation.id);
      break;

    case "suspend":
      console.log(`App suspended on ${installation.account.login}`);
      break;
  }
});
```

### Installation Repositories Events

```ts
github().event("installation_repositories", async (payload) => {
  const installation = payload.installation;

  if (payload.action === "added") {
    console.log(
      `Repos added to installation ${installation.id}:`,
      payload.repositories_added.map((r) => r.full_name),
    );
    // Index the new repositories
    for (const repo of payload.repositories_added) {
      await indexRepository(repo.full_name);
    }
  }

  if (payload.action === "removed") {
    console.log(
      `Repos removed from installation ${installation.id}:`,
      payload.repositories_removed.map((r) => r.full_name),
    );
    // Clean up removed repositories
    for (const repo of payload.repositories_removed) {
      await removeRepository(repo.full_name);
    }
  }
});
```

## Error Handling

Handle errors gracefully with built-in hooks:

```ts
const webhook = github()
  .event("push", async (payload) => {
    await riskyOperation(payload);
  })
  .onError((error, context) => {
    console.error(`Error handling ${context.eventType}:`, error);

    // context.deliveryId is available in ErrorContext
    console.error(`Delivery ID: ${context.deliveryId}`);

    // Send to error tracking
    Sentry.captureException(error, {
      tags: { webhook: "github", event: context.eventType },
      extra: { deliveryId: context.deliveryId },
    });
  })
  .onVerificationFailed((reason, headers) => {
    console.warn("Signature verification failed:", reason);

    // Potential attack or misconfiguration
    alertSecurityTeam({
      reason,
      deliveryId: headers["x-github-delivery"],
    });
  });
```

## Configuration

### Webhook Secret

Set your GitHub webhook secret via environment variable (recommended):

```bash
GITHUB_WEBHOOK_SECRET=your-secret-here
```

Or pass it explicitly:

```ts
// At provider level
const webhook = github({ secret: "your-secret" }).event("push", handler);

// Or at adapter level
export const POST = toNextJS(webhook, { secret: "your-secret" });
```

### Success Callback

Get notified when webhooks are processed successfully:

```ts
export const POST = toNextJS(webhook, {
  onSuccess: (eventType) => {
    metrics.increment("webhook.github.success", { event: eventType });
  },
});
```

## TypeScript Types

All payload types are exported for advanced use cases:

```ts
import type {
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubIssuesEvent,
} from "@better-webhook/github";

function handlePush(payload: GitHubPushEvent) {
  // Full type safety
}
```

Schemas are also exported if you need them:

```ts
import {
  GitHubPushEventSchema,
  RepositorySchema,
  CommitSchema,
} from "@better-webhook/github";

// Use for custom validation
const result = GitHubPushEventSchema.safeParse(data);
```

## License

MIT
