# AGENTS.md

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this codebase. If you ever encounter something in this project that surprises you, please alert the developer working with you and indicate that this is the case in the AGENTS.md file to help prevent future agents from having the same issue.

## Code Style Guide

- Don't add unnecessary comments that don't add value. Only add comments if they explain something that isn't obvious from the code.
- Use jsdoc comments for public APIs that end up being published to npm.

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
- Docs content under `apps/docs/content` can get out of date so whenever you make changes to the CLI or the SDK, you should see if you need to update the docs.
- Running repo-wide tasks in parallel can trigger a flaky lint failure in `packages/stripe` where ESLint tries to read a temporary `tsup.config.bundled_*.mjs` file while `tsup` is creating/removing it. If `pnpm run lint` fails with `ENOENT` for that file during concurrent verification, rerun lint on its own after the build-related tasks finish.
- Editor/LSP diagnostics in example apps can sometimes claim `@better-webhook/core` is missing exported types even when the workspace package exports them correctly; if that happens, verify against `packages/core/dist/index.d.ts` and repo typecheck output before making API changes based only on the editor error.
