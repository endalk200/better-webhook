import { z } from "zod";

// ============================================================================
// GitHub Webhook Documentation
// @see https://docs.github.com/en/webhooks/webhook-events-and-payloads
// ============================================================================

// ============================================================================
// Shared Schemas
// ============================================================================

/**
 * Repository schema (minimal)
 * Represents a GitHub repository where the webhook event occurred.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#repository
 */
export const RepositorySchema = z.object({
  /** Unique identifier for the repository */
  id: z.number(),
  /** The name of the repository (e.g., "hello-world") */
  name: z.string(),
  /** Full name including owner (e.g., "octocat/hello-world") */
  full_name: z.string(),
  /** Whether the repository is private */
  private: z.boolean(),
});

/**
 * GitHub User schema (minimal)
 * Represents a GitHub user account.
 * @see https://docs.github.com/en/rest/users
 */
export const UserSchema = z.object({
  /** The username used to login (e.g., "octocat") */
  login: z.string(),
  /** Unique identifier for the user */
  id: z.number(),
  /** Type of account: "User", "Organization", "Bot", etc. */
  type: z.string(),
});

/**
 * Account schema for GitHub App installations
 * Can be either a User or Organization account.
 */
export const AccountSchema = z.object({
  /** The username or organization name */
  login: z.string(),
  /** Unique identifier for the account */
  id: z.number(),
  /** Node ID for GraphQL API */
  node_id: z.string().optional(),
  /** URL to the account's avatar image */
  avatar_url: z.string().optional(),
  /** Type of account: "User" or "Organization" */
  type: z.enum(["User", "Organization"]),
});

/**
 * Commit schema
 * Represents a Git commit in a push event.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
 */
export const CommitSchema = z.object({
  /** The SHA hash of the commit (40 character hex string) */
  id: z.string(),
  /** The commit message */
  message: z.string(),
  /** ISO 8601 timestamp of when the commit was authored */
  timestamp: z.string(),
  /** URL to view the commit on GitHub */
  url: z.string(),
  /** The Git author of the commit */
  author: z.object({
    /** Author's display name */
    name: z.string(),
    /** Author's email address */
    email: z.string(),
    /** Author's GitHub username (if available) */
    username: z.string().optional(),
  }),
  /** The person who committed the code (may differ from author) */
  committer: z.object({
    /** Committer's display name */
    name: z.string(),
    /** Committer's email address */
    email: z.string(),
    /** Committer's GitHub username (if available) */
    username: z.string().optional(),
  }),
  /** Files added in this commit */
  added: z.array(z.string()).optional(),
  /** Files removed in this commit */
  removed: z.array(z.string()).optional(),
  /** Files modified in this commit */
  modified: z.array(z.string()).optional(),
});

// ============================================================================
// Push Event Schema
// @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
// ============================================================================

/**
 * Push event schema
 * Triggered when commits are pushed to a repository branch or tag.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
 */
export const GitHubPushEventSchema = z.object({
  /** Full Git ref that was pushed (e.g., "refs/heads/main" or "refs/tags/v1.0.0") */
  ref: z.string(),
  /** SHA of the most recent commit before the push (40 zeros for new branches) */
  before: z.string(),
  /** SHA of the most recent commit after the push */
  after: z.string(),
  /** Whether this push created the ref (new branch/tag) */
  created: z.boolean(),
  /** Whether this push deleted the ref */
  deleted: z.boolean(),
  /** Whether this was a force push */
  forced: z.boolean(),
  /** The ref of the base branch (for branch pushes derived from another branch) */
  base_ref: z.string().nullable(),
  /** URL comparing the before and after commits */
  compare: z.string(),
  /** Array of commits pushed (limited to 20, use API for more) */
  commits: z.array(CommitSchema),
  /** The most recent commit after the push (null for deleted refs) */
  head_commit: CommitSchema.nullable(),
  /** Repository where the push occurred */
  repository: RepositorySchema,
  /** User who performed the push */
  pusher: z.object({
    /** Pusher's display name */
    name: z.string(),
    /** Pusher's email address */
    email: z.string().optional(),
  }),
  /** GitHub user who triggered the event */
  sender: UserSchema,
});

// ============================================================================
// Pull Request Event Schema
// @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
// ============================================================================

/**
 * Pull request schema (minimal)
 * Represents a GitHub pull request.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
 */
export const PullRequestSchema = z.object({
  /** Unique identifier for the pull request */
  id: z.number(),
  /** Pull request number within the repository */
  number: z.number(),
  /** Current state of the pull request */
  state: z.enum(["open", "closed"]),
  /** Whether the pull request is locked */
  locked: z.boolean(),
  /** Title of the pull request */
  title: z.string(),
  /** Description/body of the pull request (Markdown) */
  body: z.string().nullable(),
  /** ISO 8601 timestamp when the PR was created */
  created_at: z.string(),
  /** ISO 8601 timestamp when the PR was last updated */
  updated_at: z.string(),
  /** ISO 8601 timestamp when the PR was closed (null if open) */
  closed_at: z.string().nullable(),
  /** ISO 8601 timestamp when the PR was merged (null if not merged) */
  merged_at: z.string().nullable(),
  /** SHA of the merge commit (null if not merged) */
  merge_commit_sha: z.string().nullable(),
  /** Whether this is a draft pull request */
  draft: z.boolean(),
  /** The head (source) branch of the pull request */
  head: z.object({
    /** Label in format "owner:branch" */
    label: z.string(),
    /** Branch name */
    ref: z.string(),
    /** SHA of the head commit */
    sha: z.string(),
  }),
  /** The base (target) branch of the pull request */
  base: z.object({
    /** Label in format "owner:branch" */
    label: z.string(),
    /** Branch name */
    ref: z.string(),
    /** SHA of the base commit */
    sha: z.string(),
  }),
  /** User who created the pull request */
  user: UserSchema,
});

/**
 * Pull request event schema
 * Triggered when a pull request is opened, closed, reopened, edited,
 * assigned, unassigned, labeled, unlabeled, synchronized, etc.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
 */
export const GitHubPullRequestEventSchema = z.object({
  /**
   * The action that was performed.
   * Possible values: "opened", "closed", "reopened", "edited", "assigned",
   * "unassigned", "review_requested", "review_request_removed", "labeled",
   * "unlabeled", "synchronize", "converted_to_draft", "ready_for_review",
   * "locked", "unlocked", "auto_merge_enabled", "auto_merge_disabled"
   */
  action: z.string(),
  /** Pull request number */
  number: z.number(),
  /** The pull request object */
  pull_request: PullRequestSchema,
  /** Repository where the event occurred */
  repository: RepositorySchema,
  /** User who triggered the event */
  sender: UserSchema,
});

// ============================================================================
// Issues Event Schema
// @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#issues
// ============================================================================

/**
 * Issue schema (minimal)
 * Represents a GitHub issue.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#issues
 */
export const IssueSchema = z.object({
  /** Unique identifier for the issue */
  id: z.number(),
  /** Issue number within the repository */
  number: z.number(),
  /** Title of the issue */
  title: z.string(),
  /** Description/body of the issue (Markdown) */
  body: z.string().nullable(),
  /** Current state of the issue */
  state: z.enum(["open", "closed"]),
  /** Whether the issue is locked */
  locked: z.boolean(),
  /** ISO 8601 timestamp when the issue was created */
  created_at: z.string(),
  /** ISO 8601 timestamp when the issue was last updated */
  updated_at: z.string(),
  /** ISO 8601 timestamp when the issue was closed (null if open) */
  closed_at: z.string().nullable(),
  /** User who created the issue */
  user: UserSchema,
  /** Labels applied to the issue */
  labels: z.array(
    z.object({
      /** Unique identifier for the label */
      id: z.number(),
      /** Name of the label */
      name: z.string(),
      /** Hex color code (without #) */
      color: z.string(),
    }),
  ),
});

/**
 * Issues event schema
 * Triggered when an issue is opened, edited, deleted, pinned, unpinned,
 * closed, reopened, assigned, unassigned, labeled, unlabeled, locked,
 * unlocked, transferred, milestoned, or demilestoned.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#issues
 */
export const GitHubIssuesEventSchema = z.object({
  /**
   * The action that was performed.
   * Possible values: "opened", "edited", "deleted", "pinned", "unpinned",
   * "closed", "reopened", "assigned", "unassigned", "labeled", "unlabeled",
   * "locked", "unlocked", "transferred", "milestoned", "demilestoned"
   */
  action: z.string(),
  /** The issue object */
  issue: IssueSchema,
  /** Repository where the event occurred */
  repository: RepositorySchema,
  /** User who triggered the event */
  sender: UserSchema,
});

// ============================================================================
// Installation Event Schema
// @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation
// ============================================================================

/**
 * GitHub App permissions schema
 * Represents the permissions granted to a GitHub App installation.
 * Keys are permission names (e.g., "contents", "issues"), values are access levels.
 */
const PermissionsSchema = z.record(z.string(), z.string()).optional();

/**
 * GitHub App Installation schema
 * Represents a GitHub App installation on an account.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation
 */
export const InstallationSchema = z.object({
  /** Unique identifier for the installation */
  id: z.number(),
  /** The account (user or organization) where the app is installed */
  account: AccountSchema,
  /** Type of repository selection: "all" or "selected" */
  repository_selection: z.enum(["all", "selected"]),
  /** URL to access the installation via API */
  access_tokens_url: z.string(),
  /** URL to the repositories accessible to this installation */
  repositories_url: z.string(),
  /** URL to the installation settings page on GitHub */
  html_url: z.string(),
  /** GitHub App ID */
  app_id: z.number(),
  /** GitHub App slug (URL-friendly name) */
  app_slug: z.string().optional(),
  /** Target ID (user or organization ID) */
  target_id: z.number(),
  /** Target type: "User" or "Organization" */
  target_type: z.enum(["User", "Organization"]),
  /** Permissions granted to the installation */
  permissions: PermissionsSchema,
  /** Events the installation is subscribed to */
  events: z.array(z.string()),
  /** ISO 8601 timestamp when the installation was created */
  created_at: z.union([z.string(), z.number()]),
  /** ISO 8601 timestamp when the installation was last updated */
  updated_at: z.union([z.string(), z.number()]),
  /** Single file paths the app has access to (if applicable) */
  single_file_name: z.string().nullable().optional(),
  /** Whether the app has multiple single files configured */
  has_multiple_single_files: z.boolean().optional(),
  /** Array of single file paths (if multiple) */
  single_file_paths: z.array(z.string()).optional(),
  /** ID of the user who suspended the installation (if suspended) */
  suspended_by: UserSchema.nullable().optional(),
  /** ISO 8601 timestamp when the installation was suspended */
  suspended_at: z.string().nullable().optional(),
});

/**
 * Installation event schema
 * Triggered when a GitHub App is installed, uninstalled, or has its
 * permissions changed on a user or organization account.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation
 */
export const GitHubInstallationEventSchema = z.object({
  /**
   * The action that was performed.
   * Possible values: "created", "deleted", "suspend", "unsuspend",
   * "new_permissions_accepted"
   */
  action: z.enum([
    "created",
    "deleted",
    "suspend",
    "unsuspend",
    "new_permissions_accepted",
  ]),
  /** The GitHub App installation */
  installation: InstallationSchema,
  /**
   * Repositories accessible to the installation (only present for "created" action).
   * An array of repository objects with minimal information.
   */
  repositories: z
    .array(
      z.object({
        /** Repository ID */
        id: z.number(),
        /** Node ID for GraphQL API */
        node_id: z.string(),
        /** Repository name */
        name: z.string(),
        /** Full name including owner */
        full_name: z.string(),
        /** Whether the repository is private */
        private: z.boolean(),
      }),
    )
    .optional(),
  /** User who triggered the event */
  sender: UserSchema,
});

// ============================================================================
// Installation Repositories Event Schema
// @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation_repositories
// ============================================================================

/**
 * Minimal repository schema for installation events
 */
export const InstallationRepositorySchema = z.object({
  /** Repository ID */
  id: z.number(),
  /** Node ID for GraphQL API */
  node_id: z.string(),
  /** Repository name */
  name: z.string(),
  /** Full name including owner */
  full_name: z.string(),
  /** Whether the repository is private */
  private: z.boolean(),
});

/**
 * Installation repositories event schema
 * Triggered when a repository is added or removed from a GitHub App installation.
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation_repositories
 */
export const GitHubInstallationRepositoriesEventSchema = z.object({
  /**
   * The action that was performed.
   * Possible values: "added", "removed"
   */
  action: z.enum(["added", "removed"]),
  /** The GitHub App installation */
  installation: InstallationSchema,
  /**
   * Repository selection type after this change.
   * "all" means the app has access to all repositories.
   * "selected" means specific repositories were selected.
   */
  repository_selection: z.enum(["all", "selected"]),
  /** Repositories added to the installation (for "added" action) */
  repositories_added: z.array(InstallationRepositorySchema),
  /** Repositories removed from the installation (for "removed" action) */
  repositories_removed: z.array(InstallationRepositorySchema),
  /** User who triggered the event (may be null for automated changes) */
  sender: UserSchema,
  /** User who requested the change (for organization installations) */
  requester: UserSchema.nullable().optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type GitHubPushEvent = z.infer<typeof GitHubPushEventSchema>;
export type GitHubPullRequestEvent = z.infer<
  typeof GitHubPullRequestEventSchema
>;
export type GitHubIssuesEvent = z.infer<typeof GitHubIssuesEventSchema>;
export type GitHubInstallationEvent = z.infer<
  typeof GitHubInstallationEventSchema
>;
export type GitHubInstallationRepositoriesEvent = z.infer<
  typeof GitHubInstallationRepositoriesEventSchema
>;
