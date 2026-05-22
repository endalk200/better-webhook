# AGENTS.md

Check [./CONTEXT.md](./CONTEXT.md) for terminology questions.

## Workflow

Whenever you make changes to the codebase run:

- `devbox -- bun run format`
- `devbox -- bun run check-types`
- `devbox -- bun run lint`
- `devbox -- bun run test`

- Always use devbox to run commands. Don't run commands in a sandboxed environment.
