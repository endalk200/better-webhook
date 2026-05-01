---
name: source-context
description: Fetch dependency source code so agents can inspect real implementations, tests, and version-specific behavior. Use when docs or types are insufficient, when debugging library internals, or when tasks require source-backed evidence. Triggers include "fetch source for", "read the source of", "how does X work internally", "get the implementation of", and "opensrc path".
---

# Source Context

Fetches dependency source code so agents can read implementations, not just types. Clones repositories at the correct version tag and caches them globally at `~/.opensrc/`.

For anything beyond a quick one-file lookup, prefer running this work in a dedicated subagent.

Use a dedicated subagent by default when you need to:

- Inspect multiple files
- Trace call paths across a library
- Compare runtime code and tests
- Verify edge-case behavior
- Investigate version-specific behavior
- Summarize findings without dumping raw source into the main thread

Have the subagent:

1. Resolve the correct source tree with `opensrc path ...`
2. Inspect the fetched code with normal search and read tools
3. Return only the relevant files, symbols, and conclusions

Prompt the subagent with the full target and question, including any version or cwd constraints.

## Usage Examples

```bash
rg "parse" $(opensrc path zod)
cat $(opensrc path zod)/src/types.ts
find $(opensrc path zod) -name "*.test.ts"
grep "parse" $(opensrc path zod)/src/types.ts

# Specific versions
## opensrc path zod@3.22.0
opensrc path pypi:flask@3.0.0
```

`opensrc path <pkg>` prints the absolute path to downloaded source. Always prefer providing a version of the package to avoid unexpected behavior.

### Version Resolution

For npm packages, `opensrc` can resolve the installed version from lockfiles such as `package-lock.json`, `bun.lock`, `pnpm-lock.yaml`, and `yarn.lock`. Use `--cwd` when the lockfiles are elsewhere in the project:

```bash
opensrc path zod --cwd /path/to/project/lock-file
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
