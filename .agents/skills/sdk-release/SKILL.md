---
name: sdk-release
description: Prepare publishable SDK package changes for push and PR in better-webhook. Use when changes under packages/* need a Changeset, SDK docs or README updates, full verification, and a release-ready PR summary before code is pushed to GitHub.
---

# SDK Release PR Prep

Use this skill when a change touches one or more publishable SDK packages under `packages/*`.

## Goal

Get an SDK change release-ready before pushing a branch or opening a PR. Do not publish, version packages, or create tags on a feature branch unless the user explicitly asks for the real release.

## Workflow

1. Identify release scope.

- Determine which `packages/*` changed and which of them are publishable (`package.json` is not `private: true`).
- Treat `apps/examples/*` as non-release artifacts; they are intentionally ignored by Changesets.
- If no publishable SDK package changed, stop using this skill.

2. Decide the release intent.

- Add a real changeset when shipped package behavior, API, types, runtime dependencies, or release-relevant docs changed.
- Use semver deliberately:
  - `major`: breaking API or runtime behavior
  - `minor`: backward-compatible feature
  - `patch`: bug fix, compatible behavior change, compatible type improvement, or compatible docs fix tied to shipped behavior
- Create the changeset with `devbox run -- pnpm changeset`.
- Only use an empty changeset when publishable package files changed but there should be no release.
- Do not manually bump `package.json` versions or edit `CHANGELOG.md`; Changesets owns that.

3. Update shipped artifacts.

- Check the touched package `README.md`.
- Check docs under `apps/docs/content` when SDK behavior, APIs, setup, or release expectations changed.
- If a public npm API changed, prefer JSDoc on exported APIs.

4. Run release-readiness verification.

- Before push or PR, run the repo verification flow:
  - `devbox run -- pnpm run format:write`
  - `devbox run -- pnpm run format:check`
  - `devbox run -- pnpm run lint`
  - `devbox run -- pnpm run check-types`
  - `devbox run -- pnpm run test`
  - `devbox run -- pnpm run build`

5. Sanity-check the release path.

- Confirm the changeset names the correct package or packages and the bump type matches the actual impact.
- Confirm docs and package README changes match the shipped behavior.
- Remember what happens after merge to `main`:
  - the Changesets workflow creates or updates the release PR
  - publish happens from `main` with npm trusted publishing via OIDC and provenance attestations
  - tags are pushed only after successful publish
- Do not run `changeset version`, `changeset publish`, or create tags as part of normal pre-PR prep.

## PR Checklist

- List the publishable SDK packages that changed.
- Name the changeset file and bump type.
- Mention any README or docs updates.
- Report the verification commands you ran and whether they passed.
- Call out any migration notes for breaking changes.
