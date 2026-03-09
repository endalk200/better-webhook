# @better-webhook/stripe

## 0.1.2

### Patch Changes

- b547738: chore: adds status code override for unhandled webhook events that are verified
- Updated dependencies [b547738]
  - @better-webhook/core@0.11.4

## 0.1.1

### Patch Changes

Add typed Stripe schema fields for `payment_intent.amount_received` and `checkout.session.custom_text` so TypeScript consumers get autocomplete and type safety for common webhook payload fields.

## 0.1.0

### Minor Changes

- feat: initial release of stripe provider
