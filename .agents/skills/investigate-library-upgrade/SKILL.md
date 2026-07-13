---
name: investigate-library-upgrade
description: Investigate what a dependency upgrade would take before implementation by tracing upstream primary-source changes to repository usage.
---

# Investigate a library upgrade

Build an **evidence chain** from the resolved current version, through upstream changes, to the repository usage each change affects. Operate assessment-only: dependency manifests, lockfiles, and source stay unchanged; the output is an assessment and, when warranted, a research note.

## 1. Resolve the version topology

Identify the package, target, ecosystem, package manager, and relevant workspaces from repository evidence. Read manifests, lockfiles, and ecosystem tooling together.

Record:

- every declared constraint and resolved version, source, dependency kind, and owning workspace;
- enabled features or extras, platform markers, aliases, overrides, forks, and replacements;
- runtime and package-manager constraints;
- the target version and selection rule. For `latest`, resolve the stable registry release and identify alternate tags or prereleases.

Complete when the package's identity, current state, target state, and every local owner are accounted for.

## 2. Research the upstream delta

Trace each material claim to its primary source. Triangulate:

1. official migration guides and documentation;
2. changelog and releases covering the version interval;
3. registry metadata, published artifacts, manifests, exports, types, and API reports;
4. source, tests, and diffs between the exact current and target tags or commits.

Inspect breaking changes, deprecations, changed semantics or defaults, relevant fixes, exports, peer dependencies, dependency graph, engines, module format, build requirements, platforms, and configuration. Reconcile registry versions with tags and releases; treat gaps and ambiguous mappings as unknowns.

Invoke `research` when the interval is broad, sources are fragmented, or a durable note would help the repository; continue local usage analysis while its background agent reads. Invoke `source-context` when documentation and types cannot settle version-specific behavior.

Complete when every version in the interval is covered by the evidence chain or named as an evidence gap.

## 3. Map repository usage

Search the relevant workspaces for imports, re-exports, types, dynamic loading, configuration, plugins, adapters, scripts, generated-code inputs, test helpers, and framework conventions.

Group matches by **usage shape**: API plus call or configuration pattern and execution context. For each shape, record its files, workspace, nearby tests, and repository commands that exercise it. At large scale, inventory all matches, inspect every distinct high-risk shape, sample only repeated equivalent shapes, and report the sample and exclusions.

Complete when every discovered match belongs to an inspected usage shape or an explicit exclusion.

## 4. Classify each intersection

Cross-reference each upstream change with each relevant usage shape:

- **No known impact** — inspected evidence shows no intersecting change.
- **Mechanical migration** — the required edit is explicit and locally checkable.
- **Behavioral risk** — compilation may succeed while semantics, defaults, timing, serialization, or output change.
- **Design decision** — the repository must choose replacement behavior or architecture.
- **Unknown** — evidence is missing, contradictory, inaccessible, or ambiguous.

Give every classification both sides of its evidence chain: an upstream citation and the local file/API evidence. Label inference as inference.

Complete when every relevant usage/change intersection is classified and evidenced.

## 5. Derive verification and rollout

Map every identified risk to exact repository-defined scripts or CI checks: resolution, compilation, types, linting, focused tests, regression builds, runtime/platform matrices, integration tests, and smoke checks. Distinguish existing commands from proposed checks and reserve target-version execution for the implementation task.

Recommend a direct upgrade, staged intermediate upgrades, a compatibility seam, or deferral behind a named decision or evidence gap.

Complete when every risk has a verification check and the rollout follows from the blast radius.

## 6. Write the assessment

Respond with these sections in order: **Recommendation**, **Version topology**, **Material upstream changes**, **Evidence matrix**, **Blast radius**, **Verification and rollout**, **Confidence and evidence gaps**, and **Next decision**. Link any note produced by `research`; otherwise persist the assessment only when the user requests a file.

Report confidence separately for version identity, upstream coverage, artifact/API coverage, usage discovery, compatibility inference, and verification coverage.

Complete when the assessment names the smallest next decision and dependency and source state remain unchanged.
