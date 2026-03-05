# Contributing to better-webhook

Thanks for your interest in contributing.

## Getting started

**Prerequisites**: Install [devbox](https://github.com/jetify-com/devbox).
This repo uses devbox to manage tools and dependencies.

1. Fork and clone the repository.
2. Install dependencies:

   ```bash
   devbox shell
   ```

3. Build and run tests before opening a pull request:

   ```bash
   devbox run -- pnpm run format:check
   devbox run -- pnpm run lint
   devbox run -- pnpm run check-types
   devbox run -- pnpm run build
   ```

4. Run security scan for the changes you added

   ```bash
   devbox run -- just security-scan
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
