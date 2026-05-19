# Event idempotency and delivery replay protection

The SDK treats idempotency and replay protection as separate concerns: idempotency coordinates processing of provider events, while replay protection rejects stale or previously observed signed delivery attempts. This keeps legitimate provider retries from running application handlers more than once when an idempotency store is configured, while still allowing provider timestamp tolerance and optional replay stores to reject suspicious delivery attempts before event handling.
