---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable local markdown issues under `.workflows/` using tracer-bullet vertical slices. Use when user wants to convert a plan into issues, create implementation tasks, or break down work into issues.
---

# To Issues

Break a plan into independently-grabbable local markdown issues using vertical slices (tracer bullets).

Use local markdown files under `.workflows/` as the workflow record unless the user explicitly requests another destination. If a task is created from or for a PRD, nest it under that PRD's `tasks/` directory. If a task is standalone, place it under `.workflows/tasks/`.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference as an argument, prefer local `.workflows/` markdown paths or identifiers and read the full file.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Write the issues to `.workflows/`

For each approved slice, create a new markdown issue file under `.workflows/`. Use the issue body template below. If the task is created from or for a PRD, place it under that PRD's `tasks/` directory. If it is not tied to a PRD, write it under `.workflows/tasks/`.

Create issues in dependency order (blockers first) so you can reference real issue identifiers in the "Blocked by" field.

Use this file convention unless the repo already has a stronger `.workflows/` convention:

- PRD task path: `.workflows/prd/YYYY-MM-DD/NNN-prd-short-kebab-title/tasks/MMM-short-kebab-title.md`
- Standalone task path: `.workflows/tasks/YYYY-MM-DD/NNN-short-kebab-title.md`
- For PRD tasks, `MMM` is the next available sequence number within that PRD's `tasks/` directory
- For standalone tasks, `NNN` is the next available sequence number within that date folder
- Identifier: the filename without `.md`; references should use relative markdown links rather than bare identifiers
- Parent and blocker references: relative markdown links to other `.workflows/` issue files

## <issue-template>

id: YYYY-MM-DD-NNN-short-kebab-title
title: Short descriptive title
type: AFK
created: YYYY-MM-DD

---

## Parent

A relative markdown link to the parent `.workflows/` issue file (if the source was an existing local issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A relative markdown link to the blocking issue file (if any)

Or "None - can start immediately" if no blockers.

</issue-template>

Do NOT close or modify any parent issue.
