---
"@better-webhook/core": minor
---

Add `catchAllHandlerScope` so endpoints can scope wildcard handlers to unknown
provider events while allowing known events without a specific handler to be
ignored by the pipeline.
