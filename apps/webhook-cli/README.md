# better-webhook CLI (Go)

The `better-webhook` CLI helps you capture, inspect, replay, and run webhook templates locally.

## Install

### Homebrew (recommended)

```bash
brew install endalk200/tap/better-webhook
```

### npm (wrapper package)

```bash
npm install -g @better-webhook/cli
```

### Go install

```bash
go install github.com/endalk200/better-webhook/apps/webhook-cli/cmd/better-webhook@latest
```

To install a pinned version, use a release tag:

```bash
go install github.com/endalk200/better-webhook/apps/webhook-cli/cmd/better-webhook@vX.Y.Z
```

### Manual binary download

Download from [GitHub Releases](https://github.com/endalk200/better-webhook/releases) and place the binary on your `PATH`.

| Platform      | Binary name                      |
| ------------- | -------------------------------- |
| macOS (ARM)   | `better-webhook-darwin-arm64`    |
| macOS (Intel) | `better-webhook-darwin-x64`      |
| Linux (ARM)   | `better-webhook-linux-arm64`     |
| Linux (x64)   | `better-webhook-linux-x64`       |
| Windows (x64) | `better-webhook-windows-x64.exe` |

## Verify

```bash
better-webhook --version
```

## Quick start

```bash
# 1) Start capture server
better-webhook capture --port 3001

# 2) List captures in another terminal
better-webhook captures list

# 3) Replay a capture to your app
better-webhook captures replay <capture-id> http://localhost:3000/api/webhooks/github
```

## Commands

### `capture`

Start a webhook capture server.

```bash
better-webhook capture [--host 0.0.0.0] [--port 3001] [--verbose]
```

### `captures`

Manage stored captures.

```bash
better-webhook captures list [--limit 20] [--provider github]
better-webhook captures delete <capture-id> [--force]
better-webhook captures replay <capture-id> [target-url]
```

`captures replay` supports `--method`, `--header`, `--timeout`, and `--verbose`.

### `replay`

Shortcut for replaying captures:

```bash
better-webhook replay <capture-id> [target-url]
```

### `templates`

Manage and execute templates:

```bash
better-webhook templates list
better-webhook templates download <template-id>
better-webhook templates local
better-webhook templates search <query>
better-webhook templates cache clear
better-webhook templates clean
better-webhook templates run <template-id> [target-url]
```

`templates run` supports `--secret`, `--allow-env-placeholders`, `--header`, `--timeout`, and `--verbose`.

## Storage paths

By default, CLI data is stored under `~/.better-webhook/`:

- `captures/` for captured requests
- `templates/` for downloaded templates
- `.index-cache.json` for template index cache

## Development

```bash
# From repo root
pnpm --filter @better-webhook/cli-go build
pnpm --filter @better-webhook/cli-go test
```
