# @better-webhook/cli

[![npm](https://img.shields.io/npm/v/@better-webhook/cli?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/cli)
[![GitHub](https://img.shields.io/github/stars/endalk200/better-webhook?style=for-the-badge&logo=github)](https://github.com/endalk200/better-webhook)
[![License](https://img.shields.io/github/license/endalk200/better-webhook?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/@better-webhook/cli?style=for-the-badge&logo=node.js)](https://nodejs.org/)

A powerful CLI tool for webhook development, testing, and management. Capture incoming webhooks, replay them, generate reusable templates, and manage webhook definitions locally.

## Features

✅ **Webhook Management** - Store and execute webhook definitions locally  
🎣 **Live Capture** - Capture incoming webhooks with a local server  
🔄 **Replay** - Replay captured webhooks to any endpoint  
📋 **Templates** - Generate reusable templates from captured requests  
📥 **Download** - Access curated webhook templates from the community  
🎯 **Override** - Override URLs, methods, and headers on the fly

## Installation

### NPM/YARN/PNPM

```bash
# Install globally
npm install -g @better-webhook/cli
# or use with npx
npx @better-webhook/cli --help

# With yarn
yarn global add @better-webhook/cli

# With pnpm
pnpm add -g @better-webhook/cli
```

### Verify Installation

```bash
better-webhook --help
```

## Quick Start

### 1. Manage Webhook Definitions

```bash
# List available webhook definitions
better-webhook webhooks list

# Download community templates
better-webhook webhooks download stripe-invoice.payment_succeeded
better-webhook webhooks download --all

# Run a webhook
better-webhook webhooks run stripe-invoice
better-webhook webhooks run mywebhook --url https://example.com/hook --method POST
```

### 2. Capture Live Webhooks

```bash
# Start capture server (default port 3001)
better-webhook capture
better-webhook capture --port 3000

# List captured webhooks
better-webhook capture list
better-webhook capture list --limit 20

# Generate template from capture
better-webhook capture template abc123 my-template-name
```

### 3. Replay Webhooks

```bash
# Replay captured webhook to any endpoint
better-webhook replay abc123 https://example.com/webhook
better-webhook replay abc123 https://test.com/hook --method PUT
```

## Commands

### `better-webhook webhooks`

Manage and execute webhook definitions stored in `.webhooks/` directory.

| Command                    | Description                        | Options             |
| -------------------------- | ---------------------------------- | ------------------- |
| `webhooks list`            | List available webhook definitions | -                   |
| `webhooks run <name>`      | Execute a webhook definition       | `--url`, `--method` |
| `webhooks download [name]` | Download community templates       | `--all`, `--force`  |

### `better-webhook capture`

Capture, list, and generate templates from live webhook requests.

| Command                        | Description                    | Options                 |
| ------------------------------ | ------------------------------ | ----------------------- |
| `capture`                      | Start webhook capture server   | `--port`                |
| `capture list`                 | List captured webhook requests | `--limit`               |
| `capture template <id> [name]` | Generate template from capture | `--url`, `--output-dir` |

### `better-webhook replay`

Replay captured webhooks to any endpoint.

| Command                          | Description             | Options                |
| -------------------------------- | ----------------------- | ---------------------- |
| `replay <captureId> <targetUrl>` | Replay captured webhook | `--method`, `--header` |

## Webhook Definition Format

Webhook definitions are JSON files that follow this schema:

```json
{
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "headers": [
    { "key": "Authorization", "value": "Bearer token123" },
    { "key": "Content-Type", "value": "application/json" }
  ],
  "body": {
    "event": "user.created",
    "data": {
      "id": "12345",
      "email": "user@example.com"
    }
  }
}
```

### Schema Fields

| Field     | Type   | Required | Description                 |
| --------- | ------ | -------- | --------------------------- |
| `url`     | string | ✅       | Target webhook URL          |
| `method`  | string | ❌       | HTTP method (default: POST) |
| `headers` | array  | ❌       | Array of header objects     |
| `body`    | any    | ❌       | Request payload             |

## Directory Structure

```
your-project/
├── .webhooks/           # Webhook definitions
│   ├── stripe-payment.json
│   ├── user-signup.json
│   └── order-complete.json
└── .webhook-captures/   # Captured requests (auto-created)
    ├── 2024-01-15T10-30-00_abc123.json
    └── 2024-01-15T11-00-00_def456.json
```

## Use Cases

### Development & Testing

```bash
# Test your webhook endpoint during development
better-webhook webhooks run test-payload --url http://localhost:3000/webhook

# Capture webhooks from external services
better-webhook capture --port 4000
# Point your webhook provider to http://localhost:4000

# Replay captured requests for debugging
better-webhook replay abc123 http://localhost:3000/debug
```

### CI/CD & Automation

```bash
# Test webhook endpoints in your pipeline
better-webhook webhooks run deployment-success --url $PROD_WEBHOOK_URL

# Capture and replay for integration testing
better-webhook capture --port 8080 &
run_integration_tests
better-webhook capture list
better-webhook replay latest-capture $TEST_ENDPOINT
```

### API Integration

```bash
# Download and customize templates for popular services
better-webhook webhooks download stripe-invoice.payment_succeeded
better-webhook webhooks run stripe-invoice --url https://myapp.com/stripe

# Generate templates from real webhook data
better-webhook capture template abc123 stripe-custom-template
```

## Examples

### Stripe Payment Webhook

```json
{
  "url": "https://api.myapp.com/webhooks/stripe",
  "method": "POST",
  "headers": [
    { "key": "Stripe-Signature", "value": "t=1234567890,v1=signature" }
  ],
  "body": {
    "id": "evt_1234567890",
    "object": "event",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_1234567890",
        "amount": 2000,
        "currency": "usd",
        "status": "succeeded"
      }
    }
  }
}
```

### GitHub Webhook

```json
{
  "url": "https://api.myapp.com/webhooks/github",
  "method": "POST",
  "headers": [
    { "key": "X-GitHub-Event", "value": "push" },
    { "key": "X-Hub-Signature-256", "value": "sha256=signature" }
  ],
  "body": {
    "ref": "refs/heads/main",
    "commits": [
      {
        "id": "abc123",
        "message": "Update README",
        "author": {
          "name": "Developer",
          "email": "dev@example.com"
        }
      }
    ]
  }
}
```

## Error Handling

The CLI provides detailed error messages and uses appropriate exit codes:

- **0**: Success
- **1**: General error (network, validation, file not found)

```bash
# Validation errors show detailed field information
better-webhook webhooks run invalid-webhook
# Error: Webhook validation failed:
#   - url: Required field missing
#   - method: Invalid HTTP method "INVALID"

# Network errors are clearly reported
better-webhook webhooks run test --url https://invalid-domain.nonexistent
# Error: Request failed: getaddrinfo ENOTFOUND invalid-domain.nonexistent
```

## Configuration

### Environment Variables

| Variable       | Description                       | Default             |
| -------------- | --------------------------------- | ------------------- |
| `WEBHOOKS_DIR` | Directory for webhook definitions | `.webhooks`         |
| `CAPTURES_DIR` | Directory for captured webhooks   | `.webhook-captures` |

### Global Options

| Flag        | Description              |
| ----------- | ------------------------ |
| `--help`    | Show help information    |
| `--version` | Show version information |

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/endalk200/better-webhook/blob/main/CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/endalk200/better-webhook.git
cd better-webhook
pnpm install
pnpm --filter @better-webhook/cli build
```

### Running Tests

```bash
pnpm --filter @better-webhook/cli test
```

## Changelog

See [CHANGELOG.md](https://github.com/endalk200/better-webhook/blob/main/apps/webhook-cli/CHANGELOG.md) for version history.

## License

MIT © [Endalk](https://github.com/endalk200)

## Support

- 🐛 [Report bugs](https://github.com/endalk200/better-webhook/issues)
- 💡 [Request features](https://github.com/endalk200/better-webhook/issues)
- 📖 [Documentation](https://github.com/endalk200/better-webhook#readme)

---

Made with ❤️ by [Endalk](https://github.com/endalk200)

