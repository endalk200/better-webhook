# Changesets

This directory stores individual change descriptions used to generate version bumps and changelogs.

Workflow:

1. After making a change that affects published packages run `pnpm changeset`.
2. Select the affected package(s) and choose the bump type (patch / minor / major).
3. Write a short, user-facing summary.
4. Commit the generated markdown file inside `.changeset/`.
5. When ready to release run one of:
   - `pnpm release:version` then open a PR (if using PR flow).
   - `pnpm release` locally to version + build + publish in one go.
6. Publish only after verifying build output.

Config sets `commit: false` so version bumps and changelog changes are NOT auto-committed; you must commit them manually.
