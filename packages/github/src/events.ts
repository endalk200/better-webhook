import { defineEvent } from "@better-webhook/core";
import {
  GitHubPushEventSchema,
  GitHubPullRequestEventSchema,
  GitHubIssuesEventSchema,
  GitHubInstallationEventSchema,
  GitHubInstallationRepositoriesEventSchema,
} from "./schemas.js";

/**
 * GitHub provider brand for type-level constraints
 */
export type GitHubProvider = "github";

/**
 * Push event - triggered when commits are pushed to a repository.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
 *
 * @example
 * ```ts
 * import { github } from "@better-webhook/github";
 * import { push } from "@better-webhook/github/events";
 *
 * const webhook = github()
 *   .event(push, async (payload) => {
 *     console.log(`Push to ${payload.ref}`);
 *     console.log(`Commits: ${payload.commits.length}`);
 *   });
 * ```
 */
export const push = defineEvent({
  name: "push",
  schema: GitHubPushEventSchema,
  provider: "github" as const,
});

/**
 * Pull request event - triggered when a PR is opened, closed, merged, etc.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
 *
 * @example
 * ```ts
 * import { github } from "@better-webhook/github";
 * import { pull_request } from "@better-webhook/github/events";
 *
 * const webhook = github()
 *   .event(pull_request, async (payload) => {
 *     if (payload.action === "opened") {
 *       console.log(`New PR: ${payload.pull_request.title}`);
 *     }
 *   });
 * ```
 */
export const pull_request = defineEvent({
  name: "pull_request",
  schema: GitHubPullRequestEventSchema,
  provider: "github" as const,
});

/**
 * Issues event - triggered when an issue is opened, closed, edited, etc.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#issues
 *
 * @example
 * ```ts
 * import { github } from "@better-webhook/github";
 * import { issues } from "@better-webhook/github/events";
 *
 * const webhook = github()
 *   .event(issues, async (payload) => {
 *     console.log(`Issue #${payload.issue.number} ${payload.action}`);
 *   });
 * ```
 */
export const issues = defineEvent({
  name: "issues",
  schema: GitHubIssuesEventSchema,
  provider: "github" as const,
});

/**
 * Installation event - triggered when a GitHub App is installed or uninstalled.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation
 *
 * @example
 * ```ts
 * import { github } from "@better-webhook/github";
 * import { installation } from "@better-webhook/github/events";
 *
 * const webhook = github()
 *   .event(installation, async (payload) => {
 *     console.log(`App ${payload.action} on ${payload.installation.account.login}`);
 *   });
 * ```
 */
export const installation = defineEvent({
  name: "installation",
  schema: GitHubInstallationEventSchema,
  provider: "github" as const,
});

/**
 * Installation repositories event - triggered when repos are added/removed from app.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation_repositories
 *
 * @example
 * ```ts
 * import { github } from "@better-webhook/github";
 * import { installation_repositories } from "@better-webhook/github/events";
 *
 * const webhook = github()
 *   .event(installation_repositories, async (payload) => {
 *     console.log(`Repos ${payload.action}`);
 *   });
 * ```
 */
export const installation_repositories = defineEvent({
  name: "installation_repositories",
  schema: GitHubInstallationRepositoriesEventSchema,
  provider: "github" as const,
});

// Re-export types for convenience
export type {
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubIssuesEvent,
  GitHubInstallationEvent,
  GitHubInstallationRepositoriesEvent,
} from "./schemas.js";
