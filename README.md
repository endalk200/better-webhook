# better-webhook

<div align="center">

[![npm](https://img.shields.io/npm/v/@better-webhook/cli?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/cli)
[![GitHub](https://img.shields.io/github/stars/endalk200/better-webhook?style=for-the-badge&logo=github)](https://github.com/endalk200/better-webhook)
[![License](https://img.shields.io/github/license/endalk200/better-webhook?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/@better-webhook/cli?style=for-the-badge&logo=node.js)](https://nodejs.org/)

**Local-first toolkit for webhook development without the pain.**

[Install](#installation) • [Documentation](#documentation) • [Examples](#examples) • [Contributing](#contributing)

</div>

---

## 🚀 Overview

Working with webhooks during development is still unnecessarily painful. You usually need a publicly reachable URL, you have to manually re-trigger external events after every code change, and valuable payloads get lost unless you copy & paste them somewhere. Debugging signature issues, replaying historical events, simulating failures, or slightly tweaking payloads to explore edge cases all require ad-hoc scripts and brittle tooling.

**better-webhook** aims to make local webhook development fast, repeatable, and delightful.

## ✨ Features

🎣 **Live Capture** - Capture incoming webhooks with a local server  
🔄 **Smart Replay** - Replay captured webhooks to any endpoint  
📋 **Template Generation** - Generate reusable templates from real webhook data  
📥 **Community Templates** - Access curated webhook templates for popular services  
🎯 **Flexible Override** - Override URLs, methods, and headers on the fly  
📁 **Local-First** - All data stored locally, no external dependencies

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

### Quick Start

```bash
# Start capturing webhooks
better-webhook capture --port 3001

# List captured webhooks
better-webhook capture list

# Generate template from capture
better-webhook capture template abc123 my-webhook-template

# Run webhook
better-webhook webhooks run my-webhook-template --url https://example.com/hook
```

## 🎯 Core Problems We Solve

✅ **Eliminate Re-triggering** - Capture once, replay infinitely  
✅ **Fast Feedback Loops** - No tunneling or public URLs needed  
✅ **Signature Debugging** - Inspect and modify headers easily  
✅ **Historical Testing** - Replay old events against new code  
✅ **Edge Case Simulation** - Tweak payloads to test edge cases

## 📚 Documentation

- **[CLI Documentation](apps/webhook-cli/README.md)** - Complete command reference
- **[Examples](#examples)** - Real-world usage examples
- **[Contributing Guide](#contributing)** - Help improve better-webhook

## 💡 Examples

### Stripe Payment Testing

```bash
# Capture Stripe webhook
better-webhook capture --port 4000
# Configure Stripe to send webhooks to http://localhost:4000

# Generate template from captured data
better-webhook capture template stripe123 stripe-payment

# Test against your local app
better-webhook webhooks run stripe-payment --url http://localhost:3000/webhooks/stripe
```

### GitHub Integration Testing

```bash
# Download GitHub webhook template
better-webhook webhooks download github-push

# Test push webhook against development server
better-webhook webhooks run github-push --url https://dev-api.example.com/github
```

### Debugging & Development

```bash
# Replay captured webhook with modified method
better-webhook replay abc123 http://localhost:8080/debug --method PUT

# List all captured webhooks
better-webhook capture list --limit 50

# Generate multiple templates from different captures
better-webhook capture template user123 user-signup
better-webhook capture template order456 order-complete
```

## 🏗️ Architecture

This monorepo contains:

- **[@better-webhook/cli](apps/webhook-cli/)** - Main CLI tool for webhook management
- **[packages/](packages/)** - Shared TypeScript configurations and ESLint rules

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
4. **Build the CLI**
   ```bash
   pnpm --filter @better-webhook/cli build
   ```
5. **Make your changes and test**
6. **Submit a pull request**

### Development Commands

```bash
# Build all packages
pnpm build

# Run CLI in development mode
pnpm --filter @better-webhook/cli dev

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
