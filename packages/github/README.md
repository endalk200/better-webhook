# @better-webhook/github

[![npm](https://img.shields.io/npm/v/@better-webhook/github?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/github)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/github?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/github)

**Handle GitHub webhooks with full type safety and tree-shaking support.**

No more guessing payload shapes. No more manual signature verification. Just beautiful, typed webhook handlers with optimal bundle sizes.

```ts
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";

const webhook = github().event(push, async (payload) => {
  // Full autocomplete for payload.repository, payload.commits, etc.
  console.log(
    `${payload.pusher.name} pushed ${payload.commits.length} commits`,
  );
});
```

## Features

- **Tree-shakeable** — Only import the events you use for optimal bundle sizes
- **Automatic signature verification** — HMAC-SHA256 verification using `x-hub-signature-256`
- **Fully typed payloads** — TypeScript knows every field on every event
- **Schema validated** — Malformed payloads are caught and rejected
- **Multiple events** — Handle `push`, `pull_request`, `issues`, and more
- **Replay key support** — Exposes `x-github-delivery` for deduplication and replay protection

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
npm install @better-webhook/hono     # Hono (Node/Workers/Bun/Deno)
npm install @better-webhook/gcp-functions # GCP Cloud Functions
```

## Quick Start

### Next.js

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload) => {
    console.log(`Push to ${payload.repository.full_name}`);

    for (const commit of payload.commits) {
      console.log(`- ${commit.message} by ${commit.author.name}`);
    }
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      console.log(`New PR #${payload.number}: ${payload.pull_request.title}`);
    }
  });

export const POST = toNextJS(webhook);
```

### Express

```ts
import express from "express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github().event(push, async (payload) => {
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
import { push } from "@better-webhook/github/events";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github().event(push, async (payload) => {
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

Import events from `@better-webhook/github/events`:

| Event                       | Import                      | Description                                          |
| --------------------------- | --------------------------- | ---------------------------------------------------- |
| `push`                      | `push`                      | Push to a repository                                 |
| `pull_request`              | `pull_request`              | Pull request opened, closed, merged, etc.            |
| `issues`                    | `issues`                    | Issue opened, closed, labeled, etc.                  |
| `installation`              | `installation`              | GitHub App installed, uninstalled, or suspended      |
| `installation_repositories` | `installation_repositories` | Repositories added/removed from a GitHub App install |

> More events coming soon! PRs welcome.

## Event Examples

### Push Events

```ts
import { push } from "@better-webhook/github/events";

github().event(push, async (payload) => {
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
    console.warn("Force push detected!");
  }
});
```

### Pull Request Events

```ts
import { pull_request } from "@better-webhook/github/events";

github().event(pull_request, async (payload) => {
  const pr = payload.pull_request;

  switch (payload.action) {
    case "opened":
      console.log(`New PR #${pr.number}: ${pr.title}`);
      console.log(`From: ${pr.head.ref} -> ${pr.base.ref}`);
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
import { issues } from "@better-webhook/github/events";

github().event(issues, async (payload) => {
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
import { installation } from "@better-webhook/github/events";

github().event(installation, async (payload) => {
  const inst = payload.installation;

  switch (payload.action) {
    case "created":
      console.log(`App installed on ${inst.account.login}`);
      // Store installation ID for API access
      await db.installations.insert({
        id: inst.id,
        account: inst.account.login,
        targetType: inst.target_type,
      });
      break;

    case "deleted":
      console.log(`App uninstalled from ${inst.account.login}`);
      await db.installations.delete(inst.id);
      break;

    case "suspend":
      console.log(`App suspended on ${inst.account.login}`);
      break;
  }
});
```

### Installation Repositories Events

```ts
import { installation_repositories } from "@better-webhook/github/events";

github().event(installation_repositories, async (payload) => {
  const inst = payload.installation;

  if (payload.action === "added") {
    console.log(
      `Repos added to installation ${inst.id}:`,
      payload.repositories_added.map((r) => r.full_name),
    );
    // Index the new repositories
    for (const repo of payload.repositories_added) {
      await indexRepository(repo.full_name);
    }
  }

  if (payload.action === "removed") {
    console.log(
      `Repos removed from installation ${inst.id}:`,
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
import { push } from "@better-webhook/github/events";

const webhook = github()
  .event(push, async (payload) => {
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
const webhook = github({ secret: "your-secret" }).event(push, handler);

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

## Replay Protection and Idempotency

GitHub includes `x-github-delivery`, which is exposed as `context.deliveryId`.
You can use this with core replay protection for storage-backed deduplication:

```ts
import { createInMemoryReplayStore } from "@better-webhook/core";

const webhook = github()
  .withReplayProtection({
    store: createInMemoryReplayStore(),
  })
  .event(push, async (payload) => {
    await processPush(payload);
  });
```

With replay protection enabled, duplicate deliveries return `409` by default.

For production, use a shared replay store that supports atomic reservation
semantics (`reserve/commit/release`). If you use Redis, implement reservation
with `SET key value NX EX ttl`.

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

## Tree-Shaking

Events are exported separately from `@better-webhook/github/events`, allowing bundlers to tree-shake unused events from your production bundle:

```ts
// Only `push` schema is included in your bundle
import { push } from "@better-webhook/github/events";

// All events included (use when you need multiple)
import { push, pull_request, issues } from "@better-webhook/github/events";
```

This is particularly beneficial for serverless deployments where bundle size matters.

## License

MIT
