# @better-webhook/github Agent Guide

## Package role

`@better-webhook/github` is the GitHub Provider Definition for Better Webhook. It verifies GitHub webhook deliveries, extracts the GitHub Event Envelope, exposes GitHub event metadata, and dispatches through core by GitHub webhook event name.

This package authenticates incoming webhook deliveries. It does not authorize outgoing GitHub API calls and does not provide GitHub App JWTs, installation tokens, Octokit helpers, check runs, statuses, PR reviews, or comment write-back helpers.

## Install

```sh
npm install @better-webhook/core @better-webhook/github
```

Most applications also install a framework adapter:

```sh
npm install @better-webhook/core @better-webhook/github @better-webhook/express
```

## Primary APIs

- `github(options)`: creates a GitHub `ProviderDefinition`.
- `knownGitHubEventTypes`: readonly list of curated GitHub event names.
- `isKnownGitHubEventType(type)`: type guard for curated event names.

`GitHubProviderOptions`:

- `webhookSecret`: GitHub webhook secret for one Webhook Endpoint. It must be a non-empty string.

The returned provider has `name: "github"` and reports replay key support. GitHub signatures do not include a signed timestamp.

## Testing and low-level helpers

- `computeGitHubSignature(secret, rawBody)`: computes the HMAC-SHA256 digest.
- `createGitHubSignatureHeader(options)`: creates a `sha256=` signature header.
- `parseGitHubSignatureHeader(header)`: parses and validates a `sha256=` signature header.
- `createGitHubReplayKey(delivery)`: returns the `X-GitHub-Delivery` value or throws if missing.
- `parseGitHubEnvelope(delivery)`: parses and validates the GitHub Event Envelope from raw delivery bytes and headers.
- `readGitHubHeaders(headers)`: reads GitHub-specific raw headers.

## Types and contracts

Important exported types include `GitHubWebhookEvent`, `KnownGitHubEvent`, `UnknownGitHubEvent`, `KnownGitHubEventType`, `GitHubEventPayloads`, `GitHubEventEnvelope`, `GitHubPayload`, `GitHubUser`, `GitHubRepository`, `GitHubInstallation`, `GitHubPullRequest`, `GitHubIssueComment`, `GitHubCheckRun`, and `GitHubProviderOptions`.

Handlers dispatch by GitHub webhook event name such as `pull_request`, `issue_comment`, or `check_run`. The payload `action` is exposed as `event.envelope.action`; action names are not flattened into handler keys.

Curated event names:

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

## Canonical example

```ts
import { createWebhookEndpoint } from "@better-webhook/core";
import { github } from "@better-webhook/github";

export const endpoint = createWebhookEndpoint({
  provider: github({ webhookSecret: process.env.GITHUB_WEBHOOK_SECRET! }),
  handlers: {
    pull_request: async ({ event }) => {
      event.id;
      event.envelope.action;
      event.payload.pull_request;
    },
    "*": async ({ event }) => {
      event.type;
    },
  },
  catchAllHandlerScope: "unknown",
});
```

## Behavior defaults

Verification requires:

- `content-type` with media type `application/json`.
- `X-Hub-Signature-256` with a valid `sha256=` HMAC-SHA256 signature.
- Signature computed over exact raw delivery bytes.

Envelope validation requires:

- non-empty `X-GitHub-Delivery`.
- non-empty `X-GitHub-Event`.
- JSON object body.
- optional string `action`.
- optional numeric `installation.id`.
- optional numeric `repository.id`.

`X-GitHub-Delivery` becomes the core Webhook Event id and the provider replay key. With an Idempotency Store, repeated deliveries with the same GitHub Delivery ID can become completed duplicates. With a Replay Store, repeated delivery keys are rejected as replayed deliveries before application handling.

## Gotchas

- GitHub manual redelivery reuses `X-GitHub-Delivery`; strict Idempotency or Replay Store settings can acknowledge or reject manual redeliveries before the handler runs.
- GitHub signatures have no signed timestamp, so Replay Protection is store-only for this provider.
- `application/x-www-form-urlencoded` payloads are intentionally unsupported.
- Legacy SHA-1 signatures and unsigned mode are unsupported.
- Payload object shapes are permissive so GitHub can add fields without forcing package updates.

## Do / do not

Do dispatch handlers by GitHub webhook event name.
Do inspect `event.envelope.action` inside event handlers when action-specific behavior matters.
Do enqueue long-running automation from handlers and acknowledge quickly.

Do not write handlers keyed as `pull_request.opened`.
Do not use webhook verification as authorization for outgoing GitHub API calls.
Do not expect this package to create GitHub App tokens or API clients.
