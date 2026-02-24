# better-webhook

[![CI](https://github.com/endalk200/better-webhook/actions/workflows/ci.yml/badge.svg)](https://github.com/endalk200/better-webhook/actions/workflows/ci.yml)
[![npm Core](https://img.shields.io/npm/v/@better-webhook/core)](https://www.npmjs.com/package/@better-webhook/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Build webhook integrations without the usual local-dev pain: capture real events, replay them instantly, and ship handlers with validation and signature verification.

Most webhook workflows still require tunnel juggling, repeated provider triggers, and hand-rolled scripts for replay and verification. `better-webhook` replaces that with a local-first workflow for faster iteration and safer production handlers.

`better-webhook` gives you:

- A local-first CLI to capture, inspect, and replay real webhook requests
- SDK packages for typed events, schema validation, and signature verification
- Flexible adoption: use only the CLI, only the SDK, or both together

## Why developers try better-webhook

- **Faster feedback loops**: capture once, replay as many times as needed
- **Less debugging guesswork**: inspect real payloads and headers locally
- **Safer production handlers**: typed payloads, schema validation, signature verification
- **Replay/idempotency controls**: provider replay keys with configurable duplicate handling (`409` by default when enabled)
- **Fits your stack**: adapters for Next.js, Express, NestJS, Hono, and more

## Start in 60 seconds

### Path 1: Local webhook testing with the CLI

```bash
# Install once (Homebrew Cask)
brew install --cask endalk200/tap/better-webhook

# Alternative install (Go)
go install github.com/endalk200/better-webhook/apps/webhook-cli/cmd/better-webhook@latest

# Start local capture API
better-webhook capture --port 3001

# Replay a captured webhook to your app
# (Use `better-webhook captures list` to find a capture ID)
better-webhook captures replay <capture-id> http://localhost:3000/api/webhooks/github
```

The CLI is available through Homebrew Cask, GitHub Releases binaries, and `go install`.

### Path 2: Type-safe webhook handlers with the SDK

```bash
npm install @better-webhook/github @better-webhook/nextjs
```

```ts
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github().event(push, async (payload) => {
  console.log(payload.repository.full_name);
});

export const POST = toNextJS(webhook);
```

## Documentation

- **Docs source**: [`apps/docs`](apps/docs)
- **CLI docs**: [`apps/webhook-cli/README.md`](apps/webhook-cli/README.md)
- **SDK docs**: [`packages/core/README.md`](packages/core/README.md)
- **Maintainer release runbook**: [`docs/cli-release-runbook.md`](docs/cli-release-runbook.md)

For deep details, use the docs source and package-level READMEs. The root README stays intentionally lightweight.

## Security behavior notes

- Incoming requests are signature-verified before unhandled events return `204`.
- When core replay protection is enabled, duplicate replay keys return `409` by default.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

If you only want to work on docs:

```bash
pnpm dev:docs
```

## Security scanning (Trivy)

Security checks are standardized with shared Trivy config so local and CI behavior stays aligned.

```bash
# Enter the reproducible security toolchain
devbox shell

# Advisory scan (HIGH/CRITICAL findings reported, does not fail)
just security-scan

# Generate SARIF locally
just security-scan-sarif
```

You can also run the same commands through package scripts:

```bash
pnpm security:scan
pnpm security:scan:sarif
```

To run blocking mode locally:

```bash
just security-scan-blocking
```

Suppression policy:

- Keep suppressions minimal and temporary in `.trivyignore`
- Keep secret tuning in `trivy-secret.yaml` scoped to examples/docs/templates only
- Remove ignores as soon as fixes are available

CI rollout:

- `CI`, `Release`, and `Changeset Check` workflows run commands through `devbox run -- just ...` for local/CI parity.
- `Security` workflow is advisory by default and always uploads SARIF
- Set repository variable `TRIVY_ENFORCE=1` to enforce HIGH/CRITICAL failures in `security.yml` and `release.yml`
- Optional `Security Cache Refresh` workflow warms Trivy DB cache daily; run it manually if CI DB downloads become slow or rate-limited

Code scanning signals in GitHub:

- `Trivy` findings are generated in `security.yml` and uploaded as SARIF to GitHub Code Scanning.
- `CodeQL` runs separately in `codeql.yml` and performs semantic source analysis for JavaScript/TypeScript.
- Seeing alerts from both sources is expected; they cover different risk classes.

## Repository map

### Package directory

- CLI: [`better-webhook` Go CLI](apps/webhook-cli/README.md)
- Core SDK: [`@better-webhook/core`](packages/core/README.md)
- Providers: [`@better-webhook/github`](packages/github/README.md), [`@better-webhook/ragie`](packages/ragie/README.md), [`@better-webhook/recall`](packages/recall/README.md)
- Adapters: [`@better-webhook/nextjs`](packages/nextjs/README.md), [`@better-webhook/express`](packages/express/README.md), [`@better-webhook/nestjs`](packages/nestjs/README.md), [`@better-webhook/hono`](packages/hono/README.md), [`@better-webhook/gcp-functions`](packages/gcp-functions/README.md)

### Monorepo layout

- [`apps/docs`](apps/docs) - docs site source (`better-webhook.dev`)
- [`apps/webhook-cli`](apps/webhook-cli) - Go CLI command implementation
- [`apps/examples`](apps/examples) - runnable framework examples
- [`packages`](packages) - SDK providers, adapters, and shared tooling

## Contributing and community

- Contributing guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- Support: [`SUPPORT.md`](SUPPORT.md)
- Security policy: [`SECURITY.md`](SECURITY.md)
- Issues: [github.com/endalk200/better-webhook/issues](https://github.com/endalk200/better-webhook/issues)

## License

MIT
