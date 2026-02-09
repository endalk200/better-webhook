# better-webhook

**Local-first toolkit for webhook development without the pain.**

[Install](#installation) • [Documentation](#documentation) • [Examples](#examples) • [Contributing](#contributing)

---

## 🚀 Overview

Working with webhooks during development is still unnecessarily painful. You usually need a publicly reachable URL, you have to manually re-trigger external events after every code change, and valuable payloads get lost unless you copy & paste them somewhere. Debugging signature issues, replaying historical events, simulating failures, or slightly tweaking payloads to explore edge cases all require ad-hoc scripts and brittle tooling.

**better-webhook** aims to make local webhook development fast, repeatable, and delightful.

## ✨ Features

🎣 **Live Capture** - Capture incoming webhooks with a local server  
🔄 **Smart Replay** - Replay captured webhooks to any endpoint  
📋 **Curated Templates** - Access webhook templates for GitHub and Ragie  
🎯 **Flexible Override** - Override URLs, methods, and headers on the fly  
📁 **Local-First** - All data stored locally, no external dependencies  
🧭 **Dashboard** - Run a local dashboard UI from the CLI to inspect, replay, and run templates  
🔐 **Type-Safe SDK** - Handle webhooks with full TypeScript support and schema validation

## 🛠️ Installation

### CLI Tool

```bash
# Install globally
npm install -g @better-webhook/cli

# Or use with npx
npx @better-webhook/cli --help

# Verify installation
better-webhook --version
```

### SDK Packages

```bash
# Core package
npm install @better-webhook/core

# Provider packages
npm install @better-webhook/github
npm install @better-webhook/ragie

# Framework adapters
npm install @better-webhook/nextjs
npm install @better-webhook/express
npm install @better-webhook/nestjs
npm install @better-webhook/hono
```

## 🚀 Quick Start

### CLI: Capture & Replay Webhooks

```bash
# Start capturing webhooks
better-webhook capture --port 3001

# Start the dashboard (UI + API + WS + in-process capture server)
better-webhook dashboard

# List captured webhooks
better-webhook captures list

# Replay a captured webhook
better-webhook replay <captureId> http://localhost:3000/webhooks

# List available templates
better-webhook templates list

# Run a template against your endpoint
better-webhook run github-push --url http://localhost:3000/webhooks/github
```

### SDK: Type-Safe Webhook Handlers

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload) => {
    // ✨ Full autocomplete for payload.repository, payload.commits, etc.
    console.log(`${payload.pusher.name} pushed to ${payload.repository.name}`);
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      console.log(`New PR #${payload.number}: ${payload.pull_request.title}`);
    }
  });

export const POST = toNextJS(webhook);
```

## 🎯 Core Problems We Solve

✅ **Eliminate Re-triggering** - Capture once, replay infinitely  
✅ **Fast Feedback Loops** - No tunneling or public URLs needed  
✅ **Signature Debugging** - Inspect and modify headers easily  
✅ **Historical Testing** - Replay old events against new code  
✅ **Edge Case Simulation** - Tweak payloads to test edge cases  
✅ **Type Safety** - Full TypeScript support with validated payloads

## 📚 Documentation

- **[CLI Documentation](apps/webhook-cli/README.md)** - Complete command reference
- **[SDK Documentation](packages/core/README.md)** - Core SDK usage
- **[GitHub Provider](packages/github/README.md)** - Handle GitHub webhooks
- **[Ragie Provider](packages/ragie/README.md)** - Handle Ragie webhooks
- **[Examples](#examples)** - Real-world usage examples

## 💡 Examples

### Capture & Replay GitHub Webhooks

```bash
# Start capture server
better-webhook capture --port 4000
# Configure GitHub to send webhooks to http://localhost:4000 (use ngrok for public URL)

# List all captured webhooks
better-webhook captures list

# Show details of a specific capture
better-webhook captures show <captureId> --body

# Replay to your local development server
better-webhook replay <captureId> http://localhost:3000/api/webhooks/github
```

### Run Templates with Signatures

```bash
# Download a GitHub webhook template
better-webhook templates download github-push

# Run with automatic signature generation
better-webhook run github-push \
  --url http://localhost:3000/webhooks/github \
  --secret "$GITHUB_WEBHOOK_SECRET"
```

### SDK Integration with Express

```ts
import express from "express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github()
  .event(push, async (payload) => {
    console.log(`Push to ${payload.repository.name}`);
  })
  .onError((error, context) => {
    console.error(`Error handling ${context.eventType}:`, error);
  });

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);

app.listen(3000);
```

## 🏗️ Architecture

This monorepo contains:

### CLI

- **[@better-webhook/cli](apps/webhook-cli/)** - CLI tool for capturing, replaying, and running webhooks

### SDK Packages

- **[@better-webhook/core](packages/core/)** - Core webhook handling with type safety and signature verification
- **[@better-webhook/github](packages/github/)** - GitHub webhook provider
- **[@better-webhook/ragie](packages/ragie/)** - Ragie webhook provider
- **[@better-webhook/nextjs](packages/nextjs/)** - Next.js adapter
- **[@better-webhook/express](packages/express/)** - Express adapter
- **[@better-webhook/nestjs](packages/nestjs/)** - NestJS adapter
- **[@better-webhook/hono](packages/hono/)** - Hono adapter

### Configuration

- **[@better-webhook/typescript-config](packages/typescript-config/)** - Shared TypeScript configuration
- **[@better-webhook/eslint-config](packages/eslint-config/)** - Shared ESLint configuration

### Apps

- **[docs](apps/docs/)** - Documentation site
- **[dashboard](apps/dashboard/)** - Dashboard UI for the CLI
- **[examples](apps/examples/)** - Example integrations

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/endalk200/better-webhook.git
   cd better-webhook
   ```
3. **Install dependencies**
   ```bash
   pnpm install
   ```
4. **Build all packages**
   ```bash
   pnpm build
   ```
5. **Make your changes and test**
6. **Submit a pull request**

### Development Commands

```bash
# Build all packages
pnpm build

# Run CLI in development mode
pnpm --filter @better-webhook/cli dev

# Run tests
pnpm test

# Lint and format
pnpm lint
pnpm format
```

## 📄 License

MIT © [Endalk](https://github.com/endalk200)

## 🔗 Links

- **[NPM Package](https://www.npmjs.com/package/@better-webhook/cli)** - Install the CLI
- **[GitHub Repository](https://github.com/endalk200/better-webhook)** - Source code
- **[Issues](https://github.com/endalk200/better-webhook/issues)** - Report bugs or request features
