# better-webhook

[![CI](https://github.com/endalk200/better-webhook/actions/workflows/ci.yml/badge.svg)](https://github.com/endalk200/better-webhook/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Build webhook integrations with typed handlers, schema validation, and signature verification.

This branch is the v2 SDK reset. The previous core, provider, adapter, example, and documentation site packages have been removed so the next SDK surface can be rebuilt from a clean workspace.

## Current workspace

- [`packages/cli`](packages/cli) - command line interface
- [`packages/eslint-config`](packages/eslint-config) - shared lint configuration
- [`packages/typescript-config`](packages/typescript-config) - shared TypeScript configuration

## Local development

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

## Contributing and community

- Contributing guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- Support: [`SUPPORT.md`](SUPPORT.md)
- Security policy: [`SECURITY.md`](SECURITY.md)
- Issues: [github.com/endalk200/better-webhook/issues](https://github.com/endalk200/better-webhook/issues)

## License

MIT
