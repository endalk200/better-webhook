# AGENTS.md

## Development Workflow Commands

- Always use devbox to run commands. Don't run commands in a sandboxed environment.
- When running any commands append `devbox run --` before. For example if you want to run lint `devbox run -- pnpm run lint`
- You can run `lint`, `test`, `check-types` and `build` commands using pnpm directly.
- If you want to run `lint`, `test`, `check-types` and `build` commands for a specific package, you can run `pnpm --filter <package> run lint`, `pnpm --filter <package> run test`, `pnpm --filter <package> run check-types` and `pnpm --filter <package> run build` respectively.

- Make sure you run formatting check using `pnpm run format:check` and format using `pnpm run format:write` at the end of your work.
- Always verify your work by running type checking, linting, testing and formatting check commands.

NOTE:

- DON'T run `pnpm dev` or `pnpm start` to start a dev server, always assume dev server is running.

## Important Notes

- This app has no users yet, make whatever changes you need without worrying about users or data or migrations.
- Docs content under `apps/docs/content` can get out of date so whenever you make changes to the SDK, you should see if you need to update the docs.
- Running repo-wide tasks in parallel can trigger a flaky lint failure in `packages/stripe` where ESLint tries to read a temporary `tsup.config.bundled_*.mjs` file while `tsup` is creating/removing it. If `pnpm run lint` fails with `ENOENT` for that file during concurrent verification, rerun lint on its own after the build-related tasks finish.
