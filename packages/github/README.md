# @better-webhook/github

GitHub Provider Definition for Better Webhook. It verifies GitHub webhook deliveries, extracts the GitHub Event Envelope, and lets a Webhook Endpoint dispatch handlers by GitHub webhook event name.

## Install

```sh
pnpm add @better-webhook/core @better-webhook/github
```

## Usage

```ts
import { createWebhookEndpoint } from "@better-webhook/core";
import { github } from "@better-webhook/github";

const endpoint = createWebhookEndpoint({
  provider: github({ webhookSecret: process.env.GITHUB_WEBHOOK_SECRET! }),
  handlers: {
    pull_request: ({ event }) => {
      console.log(event.id, event.envelope.action, event.payload.pull_request);
    },
    "*": ({ event }) => {
      console.log("verified unknown GitHub event", event.type);
    },
  },
  unknownHandlers: {
    repository_ruleset: ({ event }) => {
      console.log("specific unknown GitHub event", event.payload);
    },
  },
  catchAllHandlerScope: "unknown",
});
```

## GitHub App Setup

This package is GitHub App first. Configure an active webhook with a public HTTPS URL, a high-entropy webhook secret, SSL verification enabled, least-privilege permissions, and only the event subscriptions your app needs. Local sender scripts in the example apps are useful for development, but production receivers should use real HTTPS endpoints.

The provider expects `application/json` deliveries. `application/x-www-form-urlencoded` payloads are intentionally unsupported in this first slice and are rejected with `unsupported_github_content_type`.

## Verification

The provider requires `X-Hub-Signature-256` and verifies the `sha256=` HMAC over the exact raw delivery bytes. Missing, malformed, and mismatched signatures are rejected before JSON parsing and before Event Handler dispatch.

Unsigned mode and legacy SHA-1 fallback are not supported.

## Events

Handlers dispatch by GitHub webhook event name, for example `pull_request`, `issue_comment`, or `check_run`. The payload `action` is exposed as `event.envelope.action` when present. Action names are not flattened into handler keys, so a new GitHub action on a known event still reaches that event handler.

Known event names in this release are:

- `ping`
- `installation`
- `installation_repositories`
- `pull_request`
- `issue_comment`
- `pull_request_review`
- `pull_request_review_comment`
- `pull_request_review_thread`
- `check_run`
- `check_suite`
- `status`
- `workflow_run`
- `workflow_job`
- `merge_group`

Unknown GitHub event names remain verified and catch-all handleable with `known: false`.
Use `unknownHandlers` when you want to handle a specific verified GitHub event
name that is not in this package's curated known event map.

Runtime validation is envelope-only: the provider requires a non-empty `X-GitHub-Delivery`, a non-empty `X-GitHub-Event`, a JSON object body, optional string `action`, optional numeric `installation.id`, and optional numeric `repository.id`. GitHub payload objects stay permissive so GitHub can add fields without forcing package updates.

Known event payload types are sourced from GitHub's generated OpenAPI webhook schemas via `@octokit/openapi-webhooks-types`. Event Handler payloads are compile-time typed by GitHub webhook event name and action-specific payload unions, while runtime validation remains limited to the Event Envelope.

## Idempotency And Replay Protection

`X-GitHub-Delivery` becomes the core Webhook Event id and the provider replay key. With an Idempotency Store, a second processed delivery with the same GitHub Delivery ID is treated as a duplicate completed Webhook Event. With a Replay Store, the repeated delivery key is rejected as `replayed_delivery` before application handling.

GitHub signatures do not include a signed timestamp, so GitHub Replay Protection is store-only. GitHub manual redelivery reuses the GitHub Delivery ID; that is useful for event identity, but it means strict Idempotency and Replay Store settings can acknowledge or reject manual redeliveries before your handler runs.

## Boundaries

Webhook signature verification authenticates incoming deliveries. It does not authorize outgoing GitHub API calls. GitHub API write-back helpers, GitHub App JWT generation, installation access tokens, Octokit integration, PR comments, PR reviews, check runs, and statuses are out of scope for this package slice.

Long-running PR automation should be queued from an Event Handler and acknowledged quickly because GitHub expects timely webhook responses.
