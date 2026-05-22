# AGENTS.md

## Development Workflow Commands

- Always use devbox to run commands. Don't run commands in a sandboxed environment.
- When running any commands append `devbox run --` before. For example if you want to run lint `devbox run -- bun run lint`.
- You can run `lint`, `test`, `check-types` and `build` commands using Bun directly.
- If you want to run `lint`, `test`, `check-types` and `build` commands for a specific package, you can run `bun --filter <package> run lint`, `bun --filter <package> run test`, `bun --filter <package> run check-types` and `bun --filter <package> run build` respectively.

- Make sure you run formatting check using `bun run format:check` and format using `bun run format:write` at the end of your work.
- Always verify your work by running type checking, linting, testing and formatting check commands.

NOTE:

- DON'T run `bun run dev` or `bun run start` to start a dev server, always assume dev server is running.

## Important Notes

- This app has no users yet, make whatever changes you need without worrying about users or data or migrations.
- Docs content under `apps/docs/content` can get out of date so whenever you make changes to the SDK, you should see if you need to update the docs.
- Biome is the repository formatter and linter. Use `bun run lint` for linting and `bun run format:check` for formatting checks.
