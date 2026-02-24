## Description

<!-- Provide a clear and concise description of what this PR does -->

## Related Issue(s)

<!-- Link to related issues. Use "Fixes #123" or "Closes #123" to auto-close issues when merged -->

Fixes #

## Type of Change

<!-- Mark the relevant option(s) with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)
- [ ] 📝 Documentation update
- [ ] 🔧 Configuration change
- [ ] ♻️ Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update
- [ ] 🏗️ Build/CI change
- [ ] 🎨 Style update (formatting, naming)

## Affected Package(s)

<!-- List the packages this PR affects -->

- [ ] `@better-webhook/core`
- [ ] `@better-webhook/github`
- [ ] `@better-webhook/ragie`
- [ ] `@better-webhook/nextjs`
- [ ] `@better-webhook/express`
- [ ] `@better-webhook/nestjs`
- [ ] `@better-webhook/gcp-functions`
- [ ] `@better-webhook/cli`
- [ ] Documentation
- [ ] Examples
- [ ] Tooling/Infrastructure

## Changes Made

<!-- Describe the changes in detail. Use bullet points for clarity -->

-
-
-

## Testing

<!-- Describe how you tested these changes -->

### Test Coverage

- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] All new and existing tests pass locally with my changes
- [ ] I have verified TypeScript types are correct

### Manual Testing

<!-- Describe any manual testing you performed -->

```bash
# Commands used for testing
pnpm test
pnpm build
pnpm check-types
pnpm format:check
```

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

**Is this a breaking change?** No / Yes

<!-- If yes, explain what breaks and how users should migrate -->

## Changeset

<!--
⚠️ IMPORTANT: If this PR includes changes to published packages, you MUST include a changeset!

To create a changeset:
1. Run: pnpm changeset
2. Select affected package(s)
3. Choose version bump type (patch/minor/major)
4. Write a user-facing summary
5. Commit the generated .changeset/*.md file

Changesets are required for:
- Bug fixes → patch version (0.0.X)
- New features → minor version (0.X.0)
- Breaking changes → major version (X.0.0)

Changesets are NOT required for:
- Documentation-only changes
- Test-only changes
- Internal refactoring with no API changes
- Dev dependencies or build config changes
-->

- [ ] I have created a changeset (or this PR does not require one)
- [ ] The changeset describes user-facing changes clearly

## Code Quality Checklist

<!-- Ensure your code meets quality standards -->

- [ ] My code follows the project's style guidelines (see AGENTS.md)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code where necessary (focusing on "why", not "what")
- [ ] I have added JSDoc comments for public APIs with `@example` blocks
- [ ] My changes generate no new warnings or errors
- [ ] I have updated documentation if needed

### Code Style

- [ ] Files use kebab-case naming
- [ ] Types/Interfaces use PascalCase
- [ ] Functions use camelCase
- [ ] Node.js imports use `node:` prefix
- [ ] Local imports use `.js` extension
- [ ] Type-only imports use `type` keyword

## Build & Lint

<!-- Confirm all checks pass -->

- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm check-types` passes with no errors
- [ ] `pnpm format:check` passes (or I ran `pnpm format:write`)

## Documentation

<!-- Update documentation if your changes require it -->

- [ ] I have updated the README.md (if applicable)
- [ ] I have updated the documentation site (if applicable)
- [ ] I have added/updated JSDoc comments
- [ ] I have updated examples (if applicable)

## Screenshots / Demo

<!-- If applicable, add screenshots or demo videos -->

## Additional Notes

<!-- Any additional information reviewers should know -->

---

**For Reviewers:**

- [ ] Code changes reviewed
- [ ] Tests reviewed and passing
- [ ] Changeset reviewed (if required)
- [ ] Documentation reviewed (if updated)
- [ ] Breaking changes documented (if any)
