# better-webhook

[![CI](https://github.com/endalk200/better-webhook/actions/workflows/ci.yml/badge.svg)](https://github.com/endalk200/better-webhook/actions/workflows/ci.yml)
[![npm Core](https://img.shields.io/npm/v/@better-webhook/core)](https://www.npmjs.com/package/@better-webhook/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Build webhook integrations without the usual local-dev pain: capture real events, replay them instantly, and ship handlers with validation and signature verification.

This repo currently ships two separate delivery systems:

- SDK packages published from `main` with Changesets
- A new `2.x` CLI release line published from `cli-v*` tags

## CLI release channels

The new CLI is distributed as `bw` through:

- Homebrew cask: `better-webhook`
- npm wrapper package: `@better-webhook/cli`
- GitHub Releases archives
- Nix flake output: `.#bw`

Stable install examples:

```bash
# Homebrew
brew install --cask endalk200/tap/better-webhook

# npm
npm install -g @better-webhook/cli

# verify
bw --version
bw version --json
```

Prerelease testing should prefer `npx`:

```bash
npx @better-webhook/cli@next --version
npx @better-webhook/cli@2.0.0-alpha.1 version --json
```

## SDK quick start

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

- CLI readme: [apps/cli/README.md](/Users/endalk200/src/projects/personal/better-webhook/apps/cli/README.md)
- Release policy: [apps/docs/content/docs/release-policy.mdx](/Users/endalk200/src/projects/personal/better-webhook/apps/docs/content/docs/release-policy.mdx)
- Maintainer release runbook: [docs/cli-release-runbook.md](/Users/endalk200/src/projects/personal/better-webhook/docs/cli-release-runbook.md)
- SDK docs: [packages/core/README.md](/Users/endalk200/src/projects/personal/better-webhook/packages/core/README.md)

## Repository map

- Docs site: [apps/docs](/Users/endalk200/src/projects/personal/better-webhook/apps/docs)
- Go CLI: [apps/cli](/Users/endalk200/src/projects/personal/better-webhook/apps/cli)
- Examples: [apps/examples](/Users/endalk200/src/projects/personal/better-webhook/apps/examples)
- SDK packages: [packages](/Users/endalk200/src/projects/personal/better-webhook/packages)

## Contributing and community

- Contributing guide: [CONTRIBUTING.md](/Users/endalk200/src/projects/personal/better-webhook/CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](/Users/endalk200/src/projects/personal/better-webhook/CODE_OF_CONDUCT.md)
- Support: [SUPPORT.md](/Users/endalk200/src/projects/personal/better-webhook/SUPPORT.md)
- Security policy: [SECURITY.md](/Users/endalk200/src/projects/personal/better-webhook/SECURITY.md)
- Issues: [github.com/endalk200/better-webhook/issues](https://github.com/endalk200/better-webhook/issues)

## License

MIT
