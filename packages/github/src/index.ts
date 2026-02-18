import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookBuilder,
  type Provider,
  type Headers,
  type ProviderReplayContext,
} from "@better-webhook/core";

// Re-export types for provider brand (lightweight, no runtime import)
export type { GitHubProvider } from "./events.js";

// Re-export types for convenience (types are erased at runtime, safe for tree-shaking)
export type {
  GitHubPushEvent,
  GitHubPullRequestEvent,
  GitHubIssuesEvent,
  GitHubInstallationEvent,
  GitHubInstallationRepositoriesEvent,
} from "./schemas.js";

// ============================================================================
// GitHub Provider Implementation
// ============================================================================

/**
 * Options for creating a GitHub webhook
 */
export interface GitHubOptions {
  /**
   * Webhook secret for signature verification.
   * This should match the secret configured in your GitHub webhook settings.
   * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
   */
  secret?: string;
}

/**
 * Create a GitHub provider for webhook handling.
 * Implements signature verification using HMAC-SHA256.
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function createGitHubProvider(options?: GitHubOptions): Provider<"github"> {
  // Normalize secret: strip "sha256=" prefix if accidentally included
  let normalizedSecret = options?.secret;
  if (normalizedSecret?.startsWith("sha256=")) {
    normalizedSecret = normalizedSecret.slice("sha256=".length);
  }

  return {
    name: "github",
    secret: normalizedSecret,
    verification: "required",

    /**
     * Extract the event type from the X-GitHub-Event header.
     * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#delivery-headers
     */
    getEventType(headers: Headers, _body?: unknown): string | undefined {
      return headers["x-github-event"];
    },

    /**
     * Extract the delivery ID from the X-GitHub-Delivery header.
     * This is a GUID that uniquely identifies the webhook delivery.
     * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#delivery-headers
     */
    getDeliveryId(headers: Headers): string | undefined {
      return headers["x-github-delivery"];
    },

    getReplayContext(
      headers: Headers,
      _body?: unknown,
    ): ProviderReplayContext {
      const replayKey = headers["x-github-delivery"];
      return {
        replayKey,
      };
    },

    /**
     * Verify the webhook signature using HMAC-SHA256.
     * GitHub sends the signature in the X-Hub-Signature-256 header.
     * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
     */
    verify(
      rawBody: string | Buffer,
      headers: Headers,
      secret: string,
    ): boolean {
      const signature = headers["x-hub-signature-256"];

      if (!signature) {
        return false;
      }

      // Extract the hex signature from "sha256=<hex>"
      const expectedPrefix = "sha256=";
      if (!signature.startsWith(expectedPrefix)) {
        return false;
      }

      const expectedSignature = signature.slice(expectedPrefix.length);

      // Normalize secret: strip "sha256=" prefix if accidentally included
      // This handles cases where secret comes from env vars or adapter options
      let normalizedSecret = secret;
      if (secret.startsWith("sha256=")) {
        normalizedSecret = secret.slice("sha256=".length);
      }

      // Compute HMAC-SHA256
      const body =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
      const hmac = createHmac("sha256", normalizedSecret);
      hmac.update(body, "utf-8");
      const computedSignature = hmac.digest("hex");

      // Constant-time comparison to prevent timing attacks
      try {
        const expectedBuffer = Buffer.from(expectedSignature, "hex");
        const computedBuffer = Buffer.from(computedSignature, "hex");

        if (expectedBuffer.length !== computedBuffer.length) {
          return false;
        }

        return timingSafeEqual(expectedBuffer, computedBuffer);
      } catch {
        return false;
      }
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a GitHub webhook builder.
 *
 * Supports the following events (import from "@better-webhook/github/events"):
 * - `push` - Commits pushed to a repository
 * - `pull_request` - Pull request opened, closed, merged, etc.
 * - `issues` - Issue opened, closed, edited, etc.
 * - `installation` - GitHub App installed or uninstalled
 * - `installation_repositories` - Repositories added/removed from app
 *
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads
 *
 * @example
 * ```ts
 * import { github } from "@better-webhook/github";
 * import { push, pull_request } from "@better-webhook/github/events";
 *
 * const webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET })
 *   .event(push, async (payload) => {
 *     console.log(`Push to ${payload.repository.full_name}`);
 *     console.log(`Ref: ${payload.ref}`);
 *     console.log(`Commits: ${payload.commits.length}`);
 *   })
 *   .event(pull_request, async (payload) => {
 *     if (payload.action === 'opened') {
 *       console.log(`New PR #${payload.number}: ${payload.pull_request.title}`);
 *     }
 *   });
 * ```
 */
export function github(options?: GitHubOptions): WebhookBuilder<"github"> {
  const provider = createGitHubProvider(options);
  return new WebhookBuilder(provider);
}
