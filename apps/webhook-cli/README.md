# better-webhook CLI (Go)

The `better-webhook` CLI helps you capture, inspect, replay, and run webhook templates locally.

## Install

### Homebrew (recommended)

```bash
brew install --cask endalk200/tap/better-webhook
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

Download an archive from [GitHub Releases](https://github.com/endalk200/better-webhook/releases), extract `better-webhook`, and place it on your `PATH`.

| Platform      | Release asset                        |
| ------------- | ------------------------------------ |
| macOS (ARM)   | `better-webhook-darwin-arm64.tar.gz` |
| macOS (Intel) | `better-webhook-darwin-x64.tar.gz`   |
| Linux (ARM)   | `better-webhook-linux-arm64.tar.gz`  |
| Linux (x64)   | `better-webhook-linux-x64.tar.gz`    |
| Windows (x64) | `better-webhook-windows-x64.zip`     |

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
better-webhook capture [--host 127.0.0.1] [--port 3001] [--verbose]
```

### `captures`

Manage stored captures.

```bash
better-webhook captures list [--limit 20] [--provider github]
better-webhook captures delete <capture-id> [--force]
better-webhook captures replay <capture-id> [target-url]
```

`captures replay` supports `--base-url`, `--method`, `--header`, `--timeout`, and `--verbose`.

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
# Preferred workflow from repo root (devbox + just)
devbox run -- just build-package @better-webhook/cli-go
devbox run -- just test-package @better-webhook/cli-go

# Alternative direct commands
pnpm --filter @better-webhook/cli-go run build
pnpm --filter @better-webhook/cli-go run test
```
