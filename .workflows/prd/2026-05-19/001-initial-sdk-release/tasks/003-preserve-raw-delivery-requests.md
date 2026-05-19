id: 2026-05-19-003-preserve-raw-delivery-requests
title: Preserve Raw Delivery Requests
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Make the **Raw Delivery Request** contract explicit and testable so core and future adapters preserve method, URL, raw headers, duplicate header values when available, abort signal, and unmodified raw body bytes. This slice should protect provider signature verification from parsed, reserialized, decompressed, or header-normalized request representations while allowing adapters to declare framework-specific header preservation limits.

## Acceptance criteria

- [ ] Core request types represent raw headers and duplicate header values without lossy normalization when the adapter can provide them.
- [ ] Core reads raw body bytes exactly once before provider verification.
- [ ] Tests prove raw body mutation or reserialization can be detected by provider verification fixtures.
- [ ] Tests prove duplicate signature-relevant headers can be represented and passed to provider definitions.
- [ ] Documentation comments or package docs explain adapter obligations for raw body and raw header preservation, including how adapters declare capability limits.

## Blocked by

- [002-build-core-endpoint-pipeline-tracer.md](./002-build-core-endpoint-pipeline-tracer.md)
