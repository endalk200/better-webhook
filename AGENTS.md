# AGENTS.md

Check [./CONTEXT.md](./CONTEXT.md) for terminology questions.

## Workflow

Whenever you make changes to the codebase run:

- `devbox -- bun run format`
- `devbox -- bun run check-types`
- `devbox -- bun run lint`
- `devbox -- bun run test`

- Always use devbox to run commands. Don't run commands in a sandboxed environment.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues; pull requests are not a triage request surface. See `docs/agents/issue-tracker.md`.

### Triage and Wayfinder labels

Triage and Wayfinder use the default canonical GitHub label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.
