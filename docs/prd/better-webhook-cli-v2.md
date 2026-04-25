# better-webhook CLI Redesign PRD

## 1. Executive Summary

- **Problem Statement**: Developers building webhook handlers lose time repeatedly triggering upstream events, reconfiguring short-lived tunnel URLs, and debugging against inconsistent or unverifiable local webhook payloads. Existing workflows make it hard to iterate quickly while preserving real provider behavior such as signatures, headers, timestamps, and delivery semantics.
- **Proposed Solution**: Build `better-webhook` CLI v2 as an endpoint-centric local webhook development tool that lets developers create named endpoint profiles, run deeply curated provider-aware templates, capture real webhook deliveries, forward them transparently to local targets, and replay stored deliveries on demand. The CLI will be local-first, safe by default, machine-usable for agents and automation, and architected now for an optional future managed tunneling service.
- **Success Criteria**:
  - A new user can install the CLI, create an endpoint profile, and deliver a curated template to a local endpoint in under 5 minutes.
  - Supported provider templates pass local signature verification in at least 95% of maintained compatibility tests.
  - Supported-provider capture replay succeeds in either `exact` or `local-verified` mode in at least 95% of maintained replay tests.
  - Security controls block delivery to public remote targets in 100% of automated safety tests.
  - Human mode and machine mode both complete core endpoint setup, template run, capture, and replay flows successfully in automated integration tests across macOS, Linux, and Windows.

## 2. User Experience & Functionality

### User Personas

- **Application developer**: Builds and debugs webhook endpoints locally and wants to iterate without repeatedly retriggering upstream events.
- **SDK or framework maintainer**: Tests webhook integrations across multiple providers and events and needs high-fidelity local workflows.
- **Developer using AI agents or automation**: Wants stable machine-readable CLI behavior for scripted setup, execution, capture, and replay.

### User Stories

- **Story 1**: As a developer, I want to create a named endpoint profile so that templates, captures, replay, and future tunnel URLs all target the same local webhook endpoint configuration.
- **Story 2**: As a developer, I want to run a curated provider/event template against my local endpoint so that I can iterate without repeatedly causing real upstream events.
- **Story 3**: As a developer, I want supported template runs to generate verification-compatible signatures and provider-shaped metadata so that my real local verification logic succeeds in development.
- **Story 4**: As a developer, I want to capture real incoming webhook requests and transparently forward them to my local endpoint so that I can debug real deliveries without changing delivery semantics.
- **Story 5**: As a developer, I want to replay captured webhook requests later so that I can continue debugging without retriggering the original upstream event.
- **Story 6**: As a developer working with an unknown or custom provider, I want generic capture, forwarding, and exact replay so that the tool remains useful even before deep provider support exists.
- **Story 7**: As a developer, I want official templates to be downloadable, versioned, verifiable, and updateable while keeping my custom copies separate so that I can trust updates without losing my edits.
- **Story 8**: As a developer, I want the CLI to be human-friendly by default and machine-optimized on demand so that I can use it interactively and from AI agents or automation.

### Acceptance Criteria

- **Story 1**
  - Users can create, inspect, update, and delete named endpoint profiles.
  - Endpoint profiles support two modes: generic and provider-aware.
  - Provider-aware profiles store provider identity, local target URL, and required secret references.
  - Each endpoint profile owns a stable inbound routing binding used to attribute live captures and future tunnel deliveries to that profile.
  - The first shipped release supports path-based inbound routing, and the route must be unique within the local CLI instance.
  - Profiles enforce target safety rules and reject public remote targets.
  - Guided interactive setup is the default onboarding path, with non-interactive alternatives available.

- **Story 2**
  - Users can list, search, download, inspect, and run official templates from a local managed catalog.
  - Official templates are stored as user-visible JSONC files on disk.
  - Users can create explicit user-owned copies or forks of official templates.
  - Template execution renders runtime placeholders such as IDs, timestamps, and provider-specific signature placeholders at send time.
  - Template execution records which template and catalog version were used.

- **Story 3**
  - Supported providers generate provider-specific headers, timestamps, IDs, and signatures using the endpoint profile’s configured local secret.
  - The CLI uses raw request body bytes for signature generation where provider semantics require it.
  - The CLI surfaces whether a template supports verification-compatible execution.
  - If a required secret or capability is missing, the CLI fails clearly instead of silently degrading.

- **Story 4**
  - The CLI can run a local capture server and receive incoming webhook deliveries.
  - Incoming webhook deliveries are matched to an endpoint profile using the profile's configured inbound route before capture persistence and forwarding.
  - Live forwarding preserves original request semantics as closely as possible, including method, query, headers, duplicate headers, and raw body bytes.
  - Live forwarding uses transparent proxy behavior: the upstream sender receives the local application’s actual response status and body.
  - Captured requests are stored locally as immutable raw captures with optional provider analysis metadata.
  - The CLI can surface whether provider detection succeeded and what advanced features are available for the capture.

- **Story 5**
  - Replays support `exact` mode for raw transport fidelity.
  - Replays support `local-verified` mode when provider-aware logic and required secrets are available.
  - The default replay mode is `local-verified` when supported for the endpoint profile, otherwise `exact`.
  - The CLI clearly indicates which replay mode was used for each replay attempt.
  - Replay results include request summary, target URL, response status, duration, and failure details when applicable.

- **Story 6**
  - Generic mode supports capture, transparent forwarding, and exact replay without requiring provider configuration.
  - Generic mode does not claim unavailable capabilities such as signature generation or provider-aware replay.
  - The CLI communicates capability gaps clearly and does not silently pretend unknown providers are deeply supported.

- **Story 7**
  - Official templates are fetched from versioned catalog releases, not mutable branch state.
  - Official template downloads are protected with checksum and signature verification before use.
  - Official managed templates can be updated independently from user-owned copies.
  - User-owned copies are never overwritten by catalog updates.
  - Users can override the default template storage location.

- **Story 8**
  - Human mode provides rich interactive output with summaries, statuses, and suggested next actions.
  - Machine mode provides stable structured output suitable for agents and automation.
  - Machine mode responses include a top-level `schemaVersion` field.
  - Machine mode suppresses interactive prompts unless explicitly requested.
  - All primary commands share the same conceptual model in both modes.
  - Exit codes and output schemas remain deterministic in machine mode.
  - Breaking machine-mode schema changes require an explicit schema-version increment.

### Non-Goals

- Production webhook gateway or always-on reliability infrastructure.
- Guaranteed delivery, queueing, retry orchestration, or backlog processing.
- Cloud storage of captured payloads in the first shipped release.
- Team collaboration, shared histories, or multi-user event workspaces in the first shipped release.
- Provider account provisioning or provider dashboard automation.
- General-purpose HTTP testing against arbitrary public remote targets.
- Built-in managed tunneling in the first shipped release, though the architecture must be tunnel-ready.

## 3. AI System Requirements (If Applicable)

- **Tool Requirements**:
  - No AI generation capability is required for the core product.
  - The CLI must support AI-agent and automation use cases via a machine-optimized mode with stable structured output, deterministic exit codes, and non-interactive operation.
  - Documentation and command design should assume commands may be invoked by agents that need explicit capability reporting and predictable failure modes.
- **Evaluation Strategy**:
  - Validate that machine mode emits schema-stable output for endpoint setup, template run, capture, replay, template management, and error cases.
  - Maintain golden tests for machine-readable output contracts.
  - Verify that agent-oriented flows can complete core setup and execution paths without interactive prompts.

## 4. Technical Specifications

### Architecture Overview

- **Primary product object**: endpoint profile.
  - All major workflows hang off the endpoint profile: template runs, capture, transparent forwarding, replay, and future managed tunnel attachment.
  - Each endpoint profile includes an inbound routing binding, a local target binding, and optional provider-aware configuration.
- **Core runtime components**:
  - endpoint profile manager
  - template catalog client and local manager
  - runtime template renderer
  - provider capability registry
  - local capture server
  - transparent forwarding pipeline
  - replay engine
  - local capture store
  - output renderer for human mode and machine mode
- **Data flow: template run**
  - User selects an endpoint profile.
  - CLI resolves a local official template or user-owned copy.
  - Runtime renderer fills placeholders such as IDs, timestamps, and provider-specific signatures.
  - Delivery layer sends the rendered request to the endpoint profile’s local target.
  - CLI reports delivery result in the selected interaction mode.
- **Data flow: live capture and forward**
  - A real webhook request arrives at the local capture server or future managed tunnel relay.
  - The CLI resolves the inbound route to a single endpoint profile.
  - CLI persists the raw capture locally.
  - CLI optionally enriches the capture with provider detection and capability metadata.
  - CLI forwards the raw request transparently to the configured local target.
  - CLI mirrors the local application’s response back upstream.
- **Data flow: replay**
  - User selects a stored capture and an endpoint profile.
  - CLI chooses replay mode.
  - In `exact` mode, the raw request is resent with minimal unavoidable transport changes.
  - In `local-verified` mode, the CLI preserves original request semantics where possible while regenerating volatile provider-specific values such as signatures or timestamps required for current local verification.
  - CLI reports replay result and retains the original raw capture unchanged.
- **Storage model**:
  - Endpoint profile metadata stored locally.
  - Endpoint profiles store both the outbound local target and the inbound route binding used for capture attribution.
  - Secrets stored securely by default using the OS keychain or equivalent credential store when available, with automation-safe injection paths.
  - Captures stored locally with immutable raw request data plus optional analysis metadata.
  - Default capture retention is age-based, configurable, and set to 7 days.
  - Official templates stored in a managed local directory; user-owned copies stored separately.

### Integration Points

- **Provider integrations**
  - Official curated provider templates and their corresponding runtime implementations must reflect deep provider understanding, including signing, timestamp requirements, IDs, header conventions, and replay semantics.
  - The official catalog should not ship a provider/event pair unless the CLI can support its intended provider-aware behavior to the standard promised by the product.
  - Capability reporting must be explicit when behavior differs between generic mode and provider-aware mode, or when future experimental/community templates do not meet the same guarantees as official templates.
- **Template catalog**
  - Official templates are published through versioned releases.
  - CLI downloads a release manifest and template assets, verifies checksums and signatures, and records installed versions.
  - The product must support default storage paths with user overrides.
  - Official managed templates remain updateable artifacts; user-owned copies are the supported path for local customization.
- **Endpoint targets**
  - Delivery is restricted to `localhost`, loopback IPs, and private LAN targets.
  - Public IPs, public hostnames, and externally resolved remote endpoints are rejected.
- **Inbound routing**
  - The first shipped release uses path-based routing to bind inbound requests to endpoint profiles.
  - Each endpoint profile must have a unique inbound route.
  - Future managed tunnel URLs must map deterministically to the same endpoint-profile routing model so that local capture, forwarding, replay attribution, and permanent endpoints share one conceptual object.
- **Future managed tunneling service**
  - Must remain optional.
  - Default future behavior is to offer the managed tunnel while allowing users to opt out and use external tunneling tools.
  - Future service modes include ephemeral URLs without account creation and permanent URLs for account-backed users.
  - Raw webhook payloads must still be persisted locally by default even when passing through the future managed service.
- **Distribution**
  - CLI implementation language is Go.
  - Distribution targets are `npm`, Homebrew, and direct binary download.
  - Supported operating systems are macOS, Linux, and Windows.

### Security & Privacy

- **Local-first data posture**
  - Raw webhook request data is stored locally by default.
  - Cloud-backed payload persistence is out of scope for the first shipped release.
- **Safe delivery guardrails**
  - Template execution and replay must refuse delivery to public remote targets.
  - Local and private LAN targets are allowed.
- **Secret handling**
  - Secrets must never be echoed in normal CLI output.
  - Secret storage must prefer OS credential stores.
  - Automation-friendly secret injection must be supported without forcing plaintext config storage.
- **Integrity and trust**
  - Official template catalogs must be versioned and verified via checksum and signature validation.
  - CLI must record which official catalog version and template version were used for each template run when applicable.
- **Machine-mode contract**
  - Machine mode must publish a stable schema contract for every supported command.
  - Every machine-mode response must include a top-level `schemaVersion`.
  - Backward-incompatible changes to machine-mode output must increment `schemaVersion` and be documented.
- **Data minimization**
  - Capture retention defaults to 7 days and must be configurable.
  - CLI should make it clear that captures may contain sensitive data.
- **Behavioral honesty**
  - Live forwarding must preserve real delivery semantics and return the local application’s real response upstream.
  - The CLI must not silently change unknown-provider traffic into provider-aware behavior.

## 5. Risks & Roadmap

### Phased Rollout

- **Initial release**
  - Endpoint-profile-first CLI UX.
  - Guided interactive setup and non-interactive alternatives.
  - Local managed official template catalog with versioned release download and checksum/signature verification.
  - User-owned template copies separate from managed official templates.
  - Runtime placeholder rendering for curated provider templates.
  - Provider-aware template execution with verification-compatible signing for supported providers.
  - Local capture server with immutable raw capture storage.
  - Transparent forwarding to local and private LAN targets only.
  - Replay support with `exact` and `local-verified` modes.
  - Human mode default output and machine mode structured output.
  - Local-first storage with 7-day configurable capture retention.

- **Next release**
  - Additional provider/event coverage with matching deep runtime support.
  - Stronger provider detection and richer capture analysis.
  - Improved template inspection, comparison, and update UX.
  - Expanded machine-mode schemas and automation ergonomics.
  - Enhanced diagnostics for verification failures and replay mode selection.

- **Tunnel release**
  - Optional built-in managed tunneling service.
  - Ephemeral public URLs without required account creation.
  - Permanent URLs for account-backed users.
  - Tunnel-aware endpoint profile workflows while preserving optionality and local-first storage defaults.
  - Reconnect/resume flows for permanent endpoints.

### Technical Risks

- **Provider fidelity risk**: Deep provider-aware behavior is significantly harder than shipping static sample payloads. If runtime semantics drift from provider reality, user trust will drop quickly.
- **Signature correctness risk**: Many providers rely on raw body bytes, timestamp windows, and provider-specific signing rules. Minor implementation mistakes will cause verification failures.
- **Replay semantics risk**: Balancing exact replay fidelity with verification-compatible replay can create confusing edge cases without clear UX and capability reporting.
- **Template supply-chain risk**: Downloading catalog content from a remote source creates trust and reproducibility concerns without strong versioning and verification.
- **Cross-platform secret storage risk**: OS credential store behavior varies across macOS, Linux, and Windows and may complicate automation-friendly defaults.
- **Tunnel-architecture risk**: If the local-first MVP is not designed carefully, future optional managed tunneling may force breaking conceptual or storage changes.
- **Security expectation risk**: Because the product generates and relays realistic webhook traffic, any ambiguity in target restrictions or capability claims could create accidental misuse.
- **Retention and privacy risk**: Even local captures may accumulate sensitive request data if retention defaults and cleanup behavior are not clear and reliable.
