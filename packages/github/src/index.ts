import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createWebhook,
  type Provider,
  type Headers,
  type WebhookBuilder,
} from "@better-webhook/core";
import { z, type ZodSchema } from "zod";

// ============================================================================
// Zod Schemas for GitHub Events
// ============================================================================

/**
 * Repository schema (minimal)
 */
const RepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
});

/**
 * User schema (minimal)
 */
const UserSchema = z.object({
  login: z.string(),
  id: z.number(),
  type: z.string(),
});

/**
 * Commit schema
 */
const CommitSchema = z.object({
  id: z.string(),
  message: z.string(),
  timestamp: z.string(),
  url: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string(),
    username: z.string().optional(),
  }),
  committer: z.object({
    name: z.string(),
    email: z.string(),
    username: z.string().optional(),
  }),
  added: z.array(z.string()).optional(),
  removed: z.array(z.string()).optional(),
  modified: z.array(z.string()).optional(),
});

/**
 * Push event schema
 */
export const GitHubPushEventSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  created: z.boolean(),
  deleted: z.boolean(),
  forced: z.boolean(),
  base_ref: z.string().nullable(),
  compare: z.string(),
  commits: z.array(CommitSchema),
  head_commit: CommitSchema.nullable(),
  repository: RepositorySchema,
  pusher: z.object({
    name: z.string(),
    email: z.string().optional(),
  }),
  sender: UserSchema,
});

/**
 * Pull request schema (minimal)
 */
const PullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  state: z.enum(["open", "closed"]),
  locked: z.boolean(),
  title: z.string(),
  body: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
  merge_commit_sha: z.string().nullable(),
  draft: z.boolean(),
  head: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
  }),
  base: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
  }),
  user: UserSchema,
});

/**
 * Pull request event schema
 */
export const GitHubPullRequestEventSchema = z.object({
  action: z.string(),
  number: z.number(),
  pull_request: PullRequestSchema,
  repository: RepositorySchema,
  sender: UserSchema,
});

/**
 * Issue schema (minimal)
 */
const IssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  locked: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  user: UserSchema,
  labels: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      color: z.string(),
    })
  ),
});

/**
 * Issues event schema
 */
export const GitHubIssuesEventSchema = z.object({
  action: z.string(),
  issue: IssueSchema,
  repository: RepositorySchema,
  sender: UserSchema,
});

// ============================================================================
// Inferred Types
// ============================================================================

export type GitHubPushEvent = z.infer<typeof GitHubPushEventSchema>;
export type GitHubPullRequestEvent = z.infer<
  typeof GitHubPullRequestEventSchema
>;
export type GitHubIssuesEvent = z.infer<typeof GitHubIssuesEventSchema>;

// ============================================================================
// GitHub Event Map
// ============================================================================

/**
 * Map of GitHub event types to their schemas
 */
const GitHubSchemas = {
  push: GitHubPushEventSchema,
  pull_request: GitHubPullRequestEventSchema,
  issues: GitHubIssuesEventSchema,
} as const;

type GitHubEventMap = typeof GitHubSchemas;

// ============================================================================
// GitHub Provider Implementation
// ============================================================================

/**
 * Options for creating a GitHub webhook
 */
export interface GitHubOptions {
  /** Webhook secret for signature verification */
  secret?: string;
}

/**
 * Create a GitHub provider
 */
function createGitHubProvider(
  options?: GitHubOptions
): Provider<GitHubEventMap> {
  return {
    name: "github",
    schemas: GitHubSchemas,
    secret: options?.secret,

    getEventType(headers: Headers): string | undefined {
      return headers["x-github-event"];
    },

    getDeliveryId(headers: Headers): string | undefined {
      return headers["x-github-delivery"];
    },

    verify(
      rawBody: string | Buffer,
      headers: Headers,
      secret: string
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

      // Compute HMAC-SHA256
      const body =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
      const hmac = createHmac("sha256", secret);
      hmac.update(body, "utf-8");
      const computedSignature = hmac.digest("hex");

      // Constant-time comparison
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
 * Create a GitHub webhook builder
 *
 * @example
 * ```ts
 * const webhook = github()
 *   .event('push', async (payload) => {
 *     console.log(`Push to ${payload.repository.name}`);
 *   })
 *   .event('pull_request', async (payload) => {
 *     if (payload.action === 'opened') {
 *       console.log(`New PR: ${payload.pull_request.title}`);
 *     }
 *   });
 * ```
 */
export function github(
  options?: GitHubOptions
): WebhookBuilder<GitHubEventMap> {
  const provider = createGitHubProvider(options);
  return createWebhook(provider);
}

// Re-export schemas for advanced use cases
export {
  GitHubSchemas,
  RepositorySchema,
  UserSchema,
  CommitSchema,
  PullRequestSchema,
  IssueSchema,
};
