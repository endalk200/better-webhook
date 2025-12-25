# @better-webhook/cli

[![npm](https://img.shields.io/npm/v/@better-webhook/cli?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/cli)
[![GitHub](https://img.shields.io/github/stars/endalk200/better-webhook?style=for-the-badge&logo=github)](https://github.com/endalk200/better-webhook)
[![License](https://img.shields.io/github/license/endalk200/better-webhook?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/@better-webhook/cli?style=for-the-badge&logo=node.js)](https://nodejs.org/)

A modern CLI tool for webhook development, testing, and debugging. Capture incoming webhooks, replay them against your local server, manage reusable templates, and generate provider-specific signatures automatically.

## Features

- 🎣 **Capture** — Start a local server to capture incoming webhooks from any provider
- 🔄 **Replay** — Replay captured webhooks to any endpoint with full header preservation
- 📋 **Templates** — Download and run curated webhook templates from the community
- 🔐 **Signatures** — Automatic signature generation for Stripe, GitHub, Shopify, Slack, and more
- 🌐 **WebSocket** — Real-time capture notifications via WebSocket for dashboard integration
- 🎯 **Provider Detection** — Automatically identifies webhook providers from headers

## Supported Providers

| Provider     | Signature Algorithm             | Auto-Detection |
| ------------ | ------------------------------- | -------------- |
| Stripe       | HMAC-SHA256 (`t={ts},v1={sig}`) | ✅             |
| GitHub       | HMAC-SHA256 (`sha256={sig}`)    | ✅             |
| Shopify      | HMAC-SHA256 (Base64)            | ✅             |
| Slack        | HMAC-SHA256 (`v0={sig}`)        | ✅             |
| Twilio       | HMAC-SHA1 (Base64)              | ✅             |
| SendGrid     | HMAC-SHA256 (Base64)            | ✅             |
| Linear       | HMAC-SHA256 (Hex)               | ✅             |
| Clerk (Svix) | HMAC-SHA256 (`v1,{sig}`)        | ✅             |
| Discord      | Ed25519                         | ✅             |
| Custom       | —                               | —              |

## Installation

```bash
# NPM
npm install -g @better-webhook/cli

# Yarn
yarn global add @better-webhook/cli

# PNPM
pnpm add -g @better-webhook/cli

# Or use with npx (no installation required)
npx @better-webhook/cli --help
```

### Verify Installation

```bash
better-webhook --version
# 2.0.0
```

## Quick Start

### 1. Capture Webhooks

Start a local server to capture incoming webhooks:

```bash
# Start capture server on default port 3001
better-webhook capture

# Use a custom port
better-webhook capture --port 4000
```

Point your webhook provider (Stripe, GitHub, etc.) to `http://localhost:3001` or use a tunneling service like ngrok.

### 2. View & Manage Captures

```bash
# List captured webhooks
better-webhook captures list

# Show detailed information about a capture
better-webhook captures show abc123

# Search captures
better-webhook captures search "github"

# Delete a capture
better-webhook captures delete abc123
```

### 3. Replay Webhooks

Replay a captured webhook to your local development server:

```bash
# Interactive mode (select capture and enter URL)
better-webhook replay

# Direct replay
better-webhook replay abc123 http://localhost:3000/api/webhooks/github
```

### 4. Use Templates

Download and run curated webhook templates:

```bash
# List available templates
better-webhook templates list

# Download a template
better-webhook templates download github-push

# Run a template against your endpoint
better-webhook run github-push --url http://localhost:3000/webhooks/github
```

---

## Commands Reference

### `better-webhook capture`

Start a server to capture incoming webhooks. All captured webhooks are saved to `~/.better-webhook/captures/`.

```bash
better-webhook capture [options]
```

| Option              | Description       | Default   |
| ------------------- | ----------------- | --------- |
| `-p, --port <port>` | Port to listen on | `3001`    |
| `-h, --host <host>` | Host to bind to   | `0.0.0.0` |

**Features:**

- Automatically detects webhook provider from headers
- Saves full request including headers, body, query params
- WebSocket server for real-time notifications
- Returns capture ID in response for easy reference

**Example:**

```bash
better-webhook capture --port 4000 --host localhost
```

---

### `better-webhook captures` (alias: `c`)

Manage captured webhooks.

#### `captures list` (alias: `ls`)

List captured webhooks, sorted by most recent first.

```bash
better-webhook captures list [options]
```

| Option                      | Description                               | Default |
| --------------------------- | ----------------------------------------- | ------- |
| `-l, --limit <limit>`       | Maximum captures to show                  | `20`    |
| `-p, --provider <provider>` | Filter by provider (stripe, github, etc.) | —       |

#### `captures show <captureId>`

Show detailed information about a specific capture.

```bash
better-webhook captures show <captureId> [options]
```

| Option       | Description            |
| ------------ | ---------------------- |
| `-b, --body` | Show full body content |

**Arguments:**

- `<captureId>` — Full or partial capture ID

#### `captures search <query>`

Search captures by ID, path, method, provider, or filename.

```bash
better-webhook captures search <query>
```

#### `captures delete` (alias: `rm`)

Delete a specific captured webhook.

```bash
better-webhook captures delete <captureId> [options]
```

| Option        | Description              |
| ------------- | ------------------------ |
| `-f, --force` | Skip confirmation prompt |

#### `captures clean` (alias: `remove-all`)

Remove all captured webhooks.

```bash
better-webhook captures clean [options]
```

| Option        | Description              |
| ------------- | ------------------------ |
| `-f, --force` | Skip confirmation prompt |

---

### `better-webhook templates` (alias: `t`)

Manage webhook templates. Templates are fetched from the [better-webhook repository](https://github.com/endalk200/better-webhook/tree/main/templates).

#### `templates list` (alias: `ls`)

List available remote templates from the repository.

```bash
better-webhook templates list [options]
```

| Option                      | Description                            |
| --------------------------- | -------------------------------------- |
| `-p, --provider <provider>` | Filter by provider                     |
| `-r, --refresh`             | Force refresh the template index cache |

#### `templates download` (alias: `get`)

Download a template to local storage (`~/.better-webhook/templates/`).

```bash
better-webhook templates download [templateId] [options]
```

| Option      | Description                      |
| ----------- | -------------------------------- |
| `-a, --all` | Download all available templates |

If no `templateId` is provided, shows an interactive selection menu.

#### `templates local`

List downloaded local templates.

```bash
better-webhook templates local [options]
```

| Option                      | Description        |
| --------------------------- | ------------------ |
| `-p, --provider <provider>` | Filter by provider |

#### `templates search <query>`

Search templates by name, provider, or event type.

```bash
better-webhook templates search <query>
```

#### `templates cache`

Manage the template index cache.

```bash
better-webhook templates cache [options]
```

| Option        | Description              |
| ------------- | ------------------------ |
| `-c, --clear` | Clear the template cache |

#### `templates clean` (alias: `remove-all`)

Remove all downloaded templates.

```bash
better-webhook templates clean [options]
```

| Option        | Description              |
| ------------- | ------------------------ |
| `-f, --force` | Skip confirmation prompt |

---

### `better-webhook run`

Run a webhook template against a target URL. Automatically generates provider-specific signatures when a secret is provided.

```bash
better-webhook run [templateId] [options]
```

| Option                  | Description                                | Required |
| ----------------------- | ------------------------------------------ | -------- |
| `-u, --url <url>`       | Target URL to send the webhook to          | ✅       |
| `-s, --secret <secret>` | Secret for signature generation            | —        |
| `-H, --header <header>` | Add custom header (format: `key:value`)    | —        |
| `-v, --verbose`         | Show detailed request/response information | —        |

**Arguments:**

- `[templateId]` — Template ID to run (interactive selection if omitted)

**Signature Generation:**

When you provide a secret (`--secret`), the CLI automatically generates the correct signature header based on the template's provider. You can also use environment variables (see [Environment Variables](#environment-variables)).

**Example:**

```bash
# Run with inline secret
better-webhook run github-push \
  --url http://localhost:3000/api/webhooks/github \
  --secret "your-webhook-secret"

# Run with custom headers
better-webhook run github-push \
  --url http://localhost:3000/api/webhooks/github \
  --secret "$GITHUB_WEBHOOK_SECRET" \
  --header "X-Custom-Header:value" \
  --verbose
```

---

### `better-webhook replay`

Replay a captured webhook to a target URL. Preserves original headers (except connection-related ones) and allows overrides.

```bash
better-webhook replay [captureId] [targetUrl] [options]
```

| Option                  | Description                                  |
| ----------------------- | -------------------------------------------- |
| `-m, --method <method>` | Override HTTP method                         |
| `-H, --header <header>` | Add or override header (format: `key:value`) |
| `-v, --verbose`         | Show detailed request/response information   |

**Arguments:**

- `[captureId]` — Capture ID to replay (interactive selection if omitted)
- `[targetUrl]` — Target URL (prompts if omitted, defaults to original path on localhost:3000)

**Example:**

```bash
# Interactive mode
better-webhook replay

# Direct replay with options
better-webhook replay abc123 http://localhost:3000/webhooks \
  --method POST \
  --header "X-Debug:true" \
  --verbose
```

---

## Environment Variables

The CLI automatically reads webhook secrets from environment variables based on the provider:

| Provider | Environment Variable      |
| -------- | ------------------------- |
| Stripe   | `STRIPE_WEBHOOK_SECRET`   |
| GitHub   | `GITHUB_WEBHOOK_SECRET`   |
| Shopify  | `SHOPIFY_WEBHOOK_SECRET`  |
| Twilio   | `TWILIO_WEBHOOK_SECRET`   |
| Slack    | `SLACK_WEBHOOK_SECRET`    |
| Linear   | `LINEAR_WEBHOOK_SECRET`   |
| Clerk    | `CLERK_WEBHOOK_SECRET`    |
| SendGrid | `SENDGRID_WEBHOOK_SECRET` |
| Discord  | `DISCORD_WEBHOOK_SECRET`  |
| Custom   | `WEBHOOK_SECRET`          |

**Usage:**

```bash
export GITHUB_WEBHOOK_SECRET="your-secret-here"
better-webhook run github-push --url http://localhost:3000/webhooks/github
# Secret is automatically used for signature generation
```

---

## Storage Locations

All CLI data is stored in `~/.better-webhook/`:

```
~/.better-webhook/
├── captures/                    # Captured webhook requests
│   ├── 2024-01-15_10-30-00_abc12345.json
│   └── 2024-01-15_11-00-00_def67890.json
├── templates/                   # Downloaded templates
│   ├── github/
│   │   ├── github-push.json
│   │   └── github-pull_request.json
│   └── stripe/
│       └── stripe-invoice.json
└── templates-cache.json         # Template index cache (1 hour TTL)
```

---

## Webhook Template Format

Templates follow this JSON schema:

```json
{
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "headers": [
    { "key": "Content-Type", "value": "application/json" },
    { "key": "X-Custom-Header", "value": "custom-value" }
  ],
  "body": {
    "event": "user.created",
    "data": {
      "id": "12345",
      "email": "user@example.com"
    }
  },
  "provider": "custom",
  "event": "user.created",
  "description": "Triggered when a new user is created"
}
```

| Field         | Type   | Required | Description                                         |
| ------------- | ------ | -------- | --------------------------------------------------- |
| `url`         | string | —        | Default target URL (can be overridden with `--url`) |
| `method`      | string | —        | HTTP method (default: `POST`)                       |
| `headers`     | array  | —        | Array of `{ key, value }` header objects            |
| `body`        | any    | —        | Request payload (object or string)                  |
| `provider`    | string | —        | Provider name for signature generation              |
| `event`       | string | —        | Event type identifier                               |
| `description` | string | —        | Human-readable description                          |

---

## Captured Webhook Format

Captured webhooks are stored with full request details:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "method": "POST",
  "url": "/webhooks/github?action=opened",
  "path": "/webhooks/github",
  "headers": {
    "content-type": "application/json",
    "x-github-event": "push",
    "x-hub-signature-256": "sha256=..."
  },
  "body": { "...parsed JSON..." },
  "rawBody": "{...original string...}",
  "query": { "action": "opened" },
  "provider": "github",
  "contentType": "application/json",
  "contentLength": 1234
}
```

---

## Use Cases

### Local Development

Test your webhook endpoints during development:

```bash
# Terminal 1: Start your app
npm run dev

# Terminal 2: Capture webhooks
better-webhook capture --port 4000

# Configure your webhook provider to send to http://localhost:4000
# (use ngrok for external providers: ngrok http 4000)

# Terminal 3: Replay captured webhooks to your app
better-webhook replay abc123 http://localhost:3000/api/webhooks
```

### Debugging Webhook Issues

```bash
# Capture the problematic webhook
better-webhook capture

# Inspect the full request
better-webhook captures show abc123 --body

# Replay to your local server with verbose output
better-webhook replay abc123 http://localhost:3000/webhooks --verbose
```

### Testing Signature Verification

```bash
# Run a template with your production secret
better-webhook run stripe-invoice.payment_succeeded \
  --url http://localhost:3000/api/webhooks/stripe \
  --secret "whsec_your_stripe_secret" \
  --verbose
```

### CI/CD Integration

```bash
# Test webhook endpoints in your pipeline
better-webhook templates download github-push
better-webhook run github-push \
  --url "$TEST_ENDPOINT" \
  --secret "$GITHUB_WEBHOOK_SECRET"

# Check exit code
if [ $? -eq 0 ]; then
  echo "Webhook test passed"
fi
```

---

## WebSocket API

The capture server exposes a WebSocket endpoint on the same port for real-time notifications:

```javascript
const ws = new WebSocket("ws://localhost:3001");

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case "capture":
      console.log("New capture:", message.payload.capture);
      break;
    case "captures_updated":
      console.log("Captures list:", message.payload.captures);
      break;
  }
};
```

**Message Types:**

| Type               | Description                 | Payload               |
| ------------------ | --------------------------- | --------------------- |
| `capture`          | New webhook captured        | `{ file, capture }`   |
| `captures_updated` | Initial state on connection | `{ captures, count }` |

---

## Error Handling

The CLI uses standard exit codes:

| Code | Description                                       |
| ---- | ------------------------------------------------- |
| `0`  | Success                                           |
| `1`  | Error (validation, network, file not found, etc.) |

Detailed error messages are displayed in the terminal:

```bash
better-webhook run nonexistent-template --url http://localhost:3000
# ❌ Template not found: nonexistent-template
#    Download it with: better-webhook templates download nonexistent-template

better-webhook capture --port 99999
# Invalid port number

better-webhook replay abc123 invalid-url
# Please enter a valid URL
```

---

## Development

### Building from Source

```bash
git clone https://github.com/endalk200/better-webhook.git
cd better-webhook
pnpm install
pnpm --filter @better-webhook/cli build
```

### Running Locally

```bash
cd apps/webhook-cli
pnpm start -- capture --port 3001
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/endalk200/better-webhook/blob/main/CONTRIBUTING.md) for details.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT © [Endalk](https://github.com/endalk200)

## Support

- 🐛 [Report bugs](https://github.com/endalk200/better-webhook/issues)
- 💡 [Request features](https://github.com/endalk200/better-webhook/issues)
- 📖 [Documentation](https://github.com/endalk200/better-webhook#readme)
