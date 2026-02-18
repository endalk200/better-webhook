# Contributing to better-webhook

Thanks for your interest in contributing.

## Getting started

1. Fork and clone the repository.
2. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

3. Build and run tests before opening a pull request:

```bash
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

## Development guidelines

- Keep changes focused and small when possible.
- Add tests for behavioral or security-sensitive changes.
- Update docs when user-facing behavior changes.
- Follow existing package and workflow conventions.

## Pull requests

- Use a clear title that explains intent.
- Include a concise summary and test plan.
- Link related issues when applicable.

## Security reports

Do not disclose security vulnerabilities publicly.
Report them through the security policy in `SECURITY.md`.
