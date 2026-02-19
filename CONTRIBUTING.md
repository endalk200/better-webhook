# Contributing to better-webhook

Thanks for your interest in contributing.

## Getting started

1. Fork and clone the repository.
1. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

1. Build and run tests before opening a pull request:

```bash
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

1. Run security scans before opening a pull request:

```bash
devbox shell
just security-scan
```

## Development guidelines

- Keep changes focused and small when possible.
- Add tests for behavioral or security-sensitive changes.
- Update docs when user-facing behavior changes.
- Follow existing package and workflow conventions.

## Security scanning workflow

- Trivy config is centralized in `trivy.yaml`, `trivy-secret.yaml`, and `.trivyignore`.
- Use advisory mode during normal development: `just security-scan`.
- Use blocking mode before high-risk releases: `just security-scan-blocking`.
- SARIF output can be generated locally with `just security-scan-sarif`.
- Keep all `.trivyignore` entries small, justified, and removable.
- If local Trivy data becomes stale/corrupt, refresh it with `trivy clean --vuln-db --java-db` and rerun the scan.

## CI enforcement toggle

- Security checks run in advisory mode by default.
- Maintainers can flip CI to blocking mode by setting repository variable `TRIVY_ENFORCE=1`.
- This toggle affects `security.yml`, `release.yml`, and `binary-release.yml`.

## Pull requests

- Use a clear title that explains intent.
- Include a concise summary and test plan.
- Link related issues when applicable.

## Security reports

Do not disclose security vulnerabilities publicly.
Report them through the security policy in `SECURITY.md`.
