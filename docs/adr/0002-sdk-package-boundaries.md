# SDK package boundaries

The SDK is split into a provider-agnostic core package, provider definition packages, framework adapter packages, and an OpenTelemetry implementation package. Core owns the webhook handling pipeline and stable contracts; provider packages plug in provider-specific delivery semantics; framework adapters only translate request and response objects; and the OpenTelemetry package implements core telemetry hooks so security and retry behavior do not drift across providers or frameworks.
