# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This is a single-context repository:

- `CONTEXT.md` at the repository root defines the shared domain language.
- `docs/adr/` at the repository root contains architectural decisions.

## Before exploring, read these

- Read the root `CONTEXT.md`.
- Read ADRs under `docs/adr/` that touch the area about to be changed.

If either location does not exist, proceed silently. Domain documentation skills create or extend these files when terminology or decisions are resolved.

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, refactor proposal, hypothesis, or test name—use the term defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is absent, reconsider whether it belongs to the project's language or note the gap for domain modeling.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
