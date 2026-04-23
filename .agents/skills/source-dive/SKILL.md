---
name: source-dive
description: Fetch dependency source into a local cache so agents can inspect real implementations, not just docs or types. Prefer delegating non-trivial library investigation to a subagent that can fetch the correct version, explore the source tree, and return focused findings. Use when you need internal behavior, edge-case handling, tests, or implementation details for npm, PyPI, crates.io, and repo sources.
allowed-tools: Bash(opensrc:*), Task
---

# Source Dive

Use this skill when docs, type definitions, or surface-level examples are not enough and you need the implementation itself.

## Prefer a Subagent

For anything beyond a quick one-file lookup, prefer running this work in a dedicated subagent.

That should be the default when you need to:

- Inspect multiple files
- Trace call paths across a library
- Compare runtime code and tests
- Verify edge-case behavior
- Investigate version-specific behavior
- Summarize findings without dumping raw source into the main thread

Use the `Task` tool with `subagent_type=explore` unless the work is so broad that it needs a general-purpose agent.

Have the subagent:

1. Resolve the correct source tree with `opensrc path ...`
2. Inspect the fetched code with normal search and read tools
3. Return only the relevant files, symbols, and conclusions

Prompt the subagent with the full target and question, including any version or cwd constraints. Ask it to return:

1. Resolved source target and version/ref used
2. The key files and symbols involved
3. A concise explanation of the behavior or implementation
4. Test evidence, if present
5. Any ambiguity or assumptions

Stay in the main agent only for a very small, targeted lookup.

## Subagent Prompt Template

```text
Fetch and inspect dependency source for: [target]

Question to answer: [specific question]
Version/ref constraints: [explicit version, branch, commit, or "auto-detect from lockfile"]
Project cwd for version resolution: [path or "current workspace"]

Instructions:
1. Run `opensrc path ...` to resolve the correct source tree first.
2. Search the fetched source to find the exact implementation and any relevant tests.
3. Trace only the code paths needed to answer the question.
4. Do not dump large source files; summarize with file paths and symbol names.

Return:
1. Resolved path and version/ref used
2. Relevant files with line references when possible
3. Main control flow / behavior summary
4. Tests or examples that confirm the behavior
5. Remaining uncertainty, if any
```

## Core Workflow

```bash
opensrc path zod
opensrc path pypi:requests
opensrc path crates:serde
opensrc path facebook/react

# Multiple packages at once
opensrc path zod react next
opensrc path pypi:requests pypi:flask
opensrc path crates:serde crates:tokio

# Specific versions
opensrc path zod@3.22.0
opensrc path pypi:flask@3.0.0
opensrc path owner/repo@v1.0.0
opensrc path owner/repo#main
```

### Version Resolution

For npm packages, `opensrc` can resolve the installed version from lockfiles such as `package-lock.json`, `pnpm-lock.yaml`, and `yarn.lock`. Use `--cwd` when the project root is elsewhere:

```bash
opensrc path zod --cwd /path/to/project
```

For PyPI and crates.io packages, use an explicit version or latest. For repos, use `@ref` or `#ref` to pin a tag, branch, or commit.

## What to Inspect

Look at:

- Runtime implementation files for actual control flow
- Tests for expected behavior and edge cases
- Error construction sites for failure behavior
- Parsing, normalization, and serialization code
- Version-specific branches or adapters

## Cache Management

Source is cached globally at `~/.opensrc/`. Override that location with `OPENSRC_HOME` if needed.

```bash
opensrc list
opensrc list --json

opensrc remove zod
opensrc remove facebook/react

opensrc clean
opensrc clean --npm
opensrc clean --pypi
opensrc clean --crates
opensrc clean --packages
opensrc clean --repos
```

## When to Use This Skill

Use it when you need to:

- Understand behavior that docs or types do not explain
- Debug unexpected library behavior
- Verify how a dependency handles edge cases
- Learn from a real implementation instead of an API summary
- Support a recommendation or fix with source-backed evidence

## When Not to Use It

Do not fetch source for:

- Simple API usage questions
- Setup or installation questions
- Cases where docs or types already answer the question
- Broad research that does not require implementation details
