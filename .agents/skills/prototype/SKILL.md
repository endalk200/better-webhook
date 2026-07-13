---
name: prototype
description: Build a disposable prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like.
---

# Prototype

A prototype is **disposable code that answers a question**. It is not production code. A meaningful finished prototype may be preserved as runnable evidence, but it never belongs on the main branch. The question decides the shape.

## Pick a branch

Identify which question is being answered — from the user's prompt, the surrounding code, or by asking if the user is around:

- **"Does this logic / state model feel right?"** → [LOGIC.md](LOGIC.md). Build a tiny interactive terminal app that pushes the state machine through cases that are hard to reason about on paper.
- **"What should this look like?"** → [UI.md](UI.md). Generate several radically different UI variations on a single route, switchable via a URL search param and a floating bottom bar.

The two branches produce very different artifacts — getting this wrong wastes the whole prototype. If the question is genuinely ambiguous and the user isn't reachable, default to whichever branch better matches the surrounding code (a backend module → logic; a page or component → UI) and state the assumption at the top of the prototype.

## Rules that apply to both

1. **Disposable from day one, and clearly marked as such.** Locate the prototype code close to where it will actually be used (next to the module or page it's prototyping for) so context is obvious — but name it so a casual reader can see it's a prototype, not production. For prototype UI routes, obey whatever routing convention the project already uses; don't invent a new top-level structure.
2. **One command to run.** Whatever the project's existing task runner supports — `pnpm <name>`, `python <path>`, `bun <path>`, etc. The user must be able to start it without thinking.
3. **No persistence by default.** State lives in memory. Persistence is the thing the prototype is _checking_, not something it should depend on. If the question explicitly involves a database, hit a scratch DB or a local file with a clear "PROTOTYPE — wipe me" name.
4. **Skip the polish.** No tests, no error handling beyond what makes the prototype _runnable_, no abstractions. The point is to learn something fast, capture the evidence when it is useful, and then let the prototype go.
5. **Surface the state.** After every action (logic) or on every variant switch (UI), print or render the full relevant state so the user can see what changed.
6. **Capture before cleanup.** When the prototype has answered its question, snapshot the complete runnable experiment before changing or removing it. Keep prototype-only code out of the main branch, and reimplement the validated decision as production code rather than promoting the prototype directly.

## When done

A successful prototype can leave two useful artifacts:

1. **The decision record** — the question, the verdict, what was learned, and any important limits. Capture it in an issue, ADR, commit, or another durable project record. If the user is around, ask what the prototype taught them. If not, record the observed answer or leave a `NOTES.md` placeholder for the verdict.
2. **The evidence snapshot** — the complete runnable prototype at an immutable Git commit, kept outside the main branch so someone can inspect or rerun the original experiment.

Use this order:

1. Confirm that the prototype answered its question. An inconclusive experiment is not evidence of a decision.
2. Verify the prototype still runs in one command. Remove secrets, customer data, credentials, and unnecessary generated files; never preserve unsafe material.
3. Before deleting variants or rewriting logic, snapshot the complete prototype on an evidence branch such as `prototype/<name>`. Use an isolated worktree or another non-destructive branch workflow when the implementation branch contains unrelated work; never stash, reset, overwrite, or commit unrelated user changes to create the snapshot. Do not merge the prototype commit into the main branch.
4. If the user has authorized publishing it, push the evidence branch and link the decision record to the immutable commit URL, not only to the moving branch name. Keep the evidence branch available while the decision record references its commit. Do not push a branch or create or update an issue without authorization. If there is no remote or implementation issue, keep a local commit reference or use an existing ADR, commit, or project note.
5. Return to the implementation branch. Reimplement the validated decision with the project's normal tests, error handling, accessibility, security, and conventions. Remove every prototype-only route, switcher, shell, and variant from the main branch.

Preserving the evidence is the default when the prototype produced a meaningful decision or may be useful to rerun. It is optional when the experiment was trivial, inconclusive, unsafe to retain, or would create more clutter than value. Even when the code is deleted, keep a useful decision record if there is one.
