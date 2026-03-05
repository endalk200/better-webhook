# Better Webhook CLI

Local-first CLI tool for capturing, inspecting, and replaying webhook requests during development.

## Installation

```bash
# Homebrew (macOS/Linux)
brew install endalk200/tap/better-webhook

# Go install
go install github.com/endalk200/better-webhook/apps/webhook-cli/cmd/better-webhook@latest

# Or download binaries from GitHub Releases
# https://github.com/endalk200/better-webhook/releases
```

## Commands

### `better-webhook capture`

Start a local capture server to receive and store webhook events.

```bash
better-webhook capture --port 9090 --forward-url http://localhost:3000/api/webhooks/github
```

| Flag            | Description                         | Default |
| --------------- | ----------------------------------- | ------- |
| `--port`        | Port for the capture server         | `9090`  |
| `--forward-url` | URL to forward captured webhooks to | —       |

### `better-webhook captures list`

List all captured webhook events.

```bash
better-webhook captures list
```

### `better-webhook captures replay`

Replay captured webhooks to your application endpoint.

```bash
better-webhook captures replay --url http://localhost:3000/api/webhooks/github
```

### `better-webhook captures delete`

Delete captured webhooks.

```bash
better-webhook captures delete
```

### `better-webhook templates list`

List available webhook templates for all providers.

```bash
better-webhook templates list
```

### `better-webhook templates download`

Download templates for a specific provider.

```bash
better-webhook templates download --provider github
```

### `better-webhook templates search`

Search available templates by keyword.

```bash
better-webhook templates search push
```

### `better-webhook templates run`

Send a template payload directly to your app (generates valid signatures).

```bash
better-webhook templates run --provider github --event push --url http://localhost:3000/api/webhooks/github --secret your-webhook-secret
```

### `better-webhook init`

Create a default configuration file at `~/.better-webhook/config.toml`.

```bash
better-webhook init
```

## Configuration

Config file: `~/.better-webhook/config.toml`

```toml
[capture]
port = 9090
forward_url = "http://localhost:3000/api/webhooks/github"

[templates]
provider = "github"
```

**Precedence:** CLI flags > environment variables > config file

## Local Development Workflow

1. Install the CLI and SDK packages
2. Start your app's dev server
3. Run `better-webhook capture --forward-url http://localhost:3000/api/webhooks/github` to start the capture proxy
4. Point your webhook provider (e.g., GitHub) to the capture server URL (or use templates)
5. Use `better-webhook templates run` to send test payloads with valid signatures
6. Use `better-webhook captures replay` to re-send captured events during debugging

## Available Template Providers

| Provider | Event Examples                                                                         |
| -------- | -------------------------------------------------------------------------------------- |
| GitHub   | `push`, `pull_request`, `issues`, `installation`, `installation_repositories`          |
| Ragie    | `document_status_updated`, `document_deleted`, `entity_extracted`, `connection_sync_*` |
| Recall   | `bot.*`, `participant_events.*`, `transcript.*`                                        |
