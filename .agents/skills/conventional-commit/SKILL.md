---
name: conventional-commit
description: Create git commits using Conventional Commits. Use when the user asks to commit code, prepare a commit, write a commit message, or standardize commit history with conventional commit types, scopes, breaking-change markers, and safe git workflow checks.
---

# Conventional Commit

Create focused git commits using the Conventional Commits format.

## Commit Format

Use this structure:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

Examples:

```text
feat(auth): add password reset flow
fix(api): handle expired session tokens
docs: clarify deployment steps
refactor!: remove legacy payment adapter
```

## Types

Prefer these types:

- `feat`: a new user-facing or externally observable capability
- `fix`: a bug fix
- `docs`: documentation-only changes
- `style`: formatting or style-only changes that do not affect behavior
- `refactor`: code restructuring that neither fixes a bug nor adds a feature
- `perf`: performance improvement
- `test`: adding or updating tests only
- `build`: build system, packaging, or dependency changes
- `ci`: CI configuration or workflow changes
- `chore`: maintenance work that does not fit another type
- `revert`: revert a previous commit

Use the most specific accurate type. Do not use `feat` unless the change adds a new capability. Do not use `fix` unless it corrects broken behavior.

## Scope

Add a scope when it improves clarity:

- Use a package, app, module, route, domain, or subsystem name.
- Keep scope lowercase and short, such as `api`, `auth`, `ui`, `deps`, `billing`.
- Omit scope if the change is broad or no concise scope is obvious.

## Description

Write the description in imperative mood, lowercase unless a proper noun requires capitalization.

- Good: `fix(auth): reject expired tokens`
- Good: `docs: add local setup notes`
- Avoid: `fixed auth token issue`
- Avoid: `updates stuff`

Keep the subject line concise, ideally 72 characters or less.

## Breaking Changes

Mark breaking changes with `!` after the type or scope and include a footer:

```text
feat(api)!: require project id for exports

BREAKING CHANGE: Export requests must now include a project id.
```

Only mark a breaking change when existing consumers, persisted data, public APIs, commands, configuration, or documented behavior require migration.

## Safe Workflow

Before committing:

1. Run `git status --short` to inspect modified, staged, and untracked files.
2. Run `git diff` and `git diff --staged` to understand unstaged and staged changes.
3. Run `git log --oneline -n 10` to learn the repository's existing commit style.
4. Identify which changes belong in this commit. Do not stage unrelated user changes.
5. Do not commit secrets, credentials, local environment files, generated artifacts, or unrelated formatting churn.
6. If there are suspicious files such as `.env`, private keys, tokens, or credential JSON files, stop and ask before committing them.

When staging:

- Stage only files directly related to the requested commit.
- Preserve unrelated worktree changes.
- Prefer explicit paths with `git add <path>`.
- Avoid broad staging with `git add .` unless all changes have been reviewed and clearly belong together.

When committing:

- Use `git commit -m "<conventional subject>"` for simple commits.
- Use multiple `-m` flags when a body or footer is needed.
- Do not bypass hooks with `--no-verify` unless the user explicitly asks.
- Do not amend unless the user explicitly asks.
- Do not push unless the user explicitly asks.

After committing:

1. Run `git status --short` to verify the commit succeeded and confirm any remaining changes are intentional.
2. Report the commit hash and message.
3. Mention any uncommitted changes left behind.

## Message Selection

Choose the message from the actual diff, not from the user's phrasing alone.

Use this decision process:

1. If the diff is documentation only, use `docs`.
2. If the diff is tests only, use `test`.
3. If the diff changes build tooling, package metadata, lockfiles, or dependencies, use `build` unless it is purely CI.
4. If the diff changes CI files or automation workflows, use `ci`.
5. If the diff fixes incorrect behavior, use `fix`.
6. If the diff adds a new capability, use `feat`.
7. If the diff restructures code without behavior change, use `refactor`.
8. If the diff improves runtime performance, use `perf`.
9. If none apply and the work is maintenance, use `chore`.

If multiple unrelated changes are present, ask whether to split them into separate commits unless the user already specified grouping.

## Commit Body

Add a body only when it adds useful context that the subject cannot capture.

Use the body to explain why the change was needed, notable behavior changes, migrations, or tradeoffs. Do not restate the file list.

Example:

```text
fix(cache): avoid stale project permissions

Permission checks now include the role version in the cache key so role updates take effect without waiting for TTL expiry.
```

## Footers

Use footers for metadata such as issues, breaking changes, or co-authors:

```text
Closes #123
Refs #456
BREAKING CHANGE: The config file now uses `projectId` instead of `id`.
```

## Output Style

When done, respond briefly:

```text
Committed `<hash>` with `type(scope): description`.
```

If no commit was created, explain why and list the blocker.
