---
"@better-webhook/github": minor
"@better-webhook/core": minor
---

Use GitHub's generated OpenAPI webhook schemas for known event payload types so handlers receive action-aware, fully typed payloads.

Fix Event Handler map narrowing when a provider event union includes both literal known events and an unknown catch-all string event.
