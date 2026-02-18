import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  github,
  type GitHubPushEvent,
  type GitHubPullRequestEvent,
  type GitHubIssuesEvent,
  type GitHubInstallationEvent,
  type GitHubInstallationRepositoriesEvent,
} from "./index.js";
import { push, pull_request, issues } from "./events.js";
import {
  GitHubPushEventSchema,
  GitHubPullRequestEventSchema,
  GitHubIssuesEventSchema,
  GitHubInstallationEventSchema,
  GitHubInstallationRepositoriesEventSchema,
} from "./schemas.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const validPushPayload: GitHubPushEvent = {
  ref: "refs/heads/main",
  before: "abc123",
  after: "def456",
  created: false,
  deleted: false,
  forced: false,
  base_ref: null,
  compare: "https://github.com/org/repo/compare/abc123...def456",
  commits: [
    {
      id: "def456",
      message: "Update README",
      timestamp: "2024-01-01T00:00:00Z",
      url: "https://github.com/org/repo/commit/def456",
      author: {
        name: "Test User",
        email: "test@example.com",
        username: "testuser",
      },
      committer: {
        name: "Test User",
        email: "test@example.com",
        username: "testuser",
      },
      added: ["README.md"],
      removed: [],
      modified: [],
    },
  ],
  head_commit: {
    id: "def456",
    message: "Update README",
    timestamp: "2024-01-01T00:00:00Z",
    url: "https://github.com/org/repo/commit/def456",
    author: {
      name: "Test User",
      email: "test@example.com",
      username: "testuser",
    },
    committer: {
      name: "Test User",
      email: "test@example.com",
      username: "testuser",
    },
    added: ["README.md"],
    removed: [],
    modified: [],
  },
  repository: {
    id: 123,
    name: "repo",
    full_name: "org/repo",
    private: false,
  },
  pusher: {
    name: "testuser",
    email: "test@example.com",
  },
  sender: {
    login: "testuser",
    id: 456,
    type: "User",
  },
};

const validPullRequestPayload: GitHubPullRequestEvent = {
  action: "opened",
  number: 1,
  pull_request: {
    id: 1,
    number: 1,
    state: "open",
    locked: false,
    title: "Test PR",
    body: "Test body",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    merged_at: null,
    merge_commit_sha: null,
    draft: false,
    head: {
      label: "org:feature",
      ref: "feature",
      sha: "abc123",
    },
    base: {
      label: "org:main",
      ref: "main",
      sha: "def456",
    },
    user: {
      login: "testuser",
      id: 456,
      type: "User",
    },
  },
  repository: {
    id: 123,
    name: "repo",
    full_name: "org/repo",
    private: false,
  },
  sender: {
    login: "testuser",
    id: 456,
    type: "User",
  },
};

const validIssuesPayload: GitHubIssuesEvent = {
  action: "opened",
  issue: {
    id: 1,
    number: 1,
    title: "Test Issue",
    body: "Test body",
    state: "open",
    locked: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    closed_at: null,
    user: {
      login: "testuser",
      id: 456,
      type: "User",
    },
    labels: [
      {
        id: 1,
        name: "bug",
        color: "ff0000",
      },
    ],
  },
  repository: {
    id: 123,
    name: "repo",
    full_name: "org/repo",
    private: false,
  },
  sender: {
    login: "testuser",
    id: 456,
    type: "User",
  },
};

const validInstallationPayload: GitHubInstallationEvent = {
  action: "created",
  installation: {
    id: 1,
    account: {
      login: "octocat",
      id: 123,
      type: "User",
    },
    repository_selection: "all",
    access_tokens_url:
      "https://api.github.com/app/installations/1/access_tokens",
    repositories_url: "https://api.github.com/installation/repositories",
    html_url: "https://github.com/settings/installations/1",
    app_id: 999,
    target_id: 123,
    target_type: "User",
    permissions: { contents: "read" },
    events: ["push"],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  sender: {
    login: "octocat",
    id: 123,
    type: "User",
  },
};

const validInstallationReposPayload: GitHubInstallationRepositoriesEvent = {
  action: "added",
  installation: validInstallationPayload.installation,
  repository_selection: "selected",
  repositories_added: [
    {
      id: 1,
      node_id: "R_kgDOExample",
      name: "example",
      full_name: "octocat/example",
      private: false,
    },
  ],
  repositories_removed: [],
  sender: {
    login: "octocat",
    id: 123,
    type: "User",
  },
};

function createSignature(body: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(body, "utf-8");
  return `sha256=${hmac.digest("hex")}`;
}

// ============================================================================
// Schema Tests
// ============================================================================

describe("GitHub Schemas", () => {
  describe("GitHubPushEventSchema", () => {
    it("should validate a valid push event", () => {
      const result = GitHubPushEventSchema.safeParse(validPushPayload);
      expect(result.success).toBe(true);
    });

    it("should reject invalid push event", () => {
      const result = GitHubPushEventSchema.safeParse({ invalid: true });
      expect(result.success).toBe(false);
    });
  });

  describe("GitHubPullRequestEventSchema", () => {
    it("should validate a valid pull request event", () => {
      const result = GitHubPullRequestEventSchema.safeParse(
        validPullRequestPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid pull request event", () => {
      const result = GitHubPullRequestEventSchema.safeParse({ invalid: true });
      expect(result.success).toBe(false);
    });
  });

  describe("GitHubIssuesEventSchema", () => {
    it("should validate a valid issues event", () => {
      const result = GitHubIssuesEventSchema.safeParse(validIssuesPayload);
      expect(result.success).toBe(true);
    });

    it("should reject invalid issues event", () => {
      const result = GitHubIssuesEventSchema.safeParse({ invalid: true });
      expect(result.success).toBe(false);
    });
  });

  describe("GitHubInstallationEventSchema", () => {
    it("should validate a valid installation event", () => {
      const result = GitHubInstallationEventSchema.safeParse(
        validInstallationPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid installation event", () => {
      const result = GitHubInstallationEventSchema.safeParse({ invalid: true });
      expect(result.success).toBe(false);
    });
  });

  describe("GitHubInstallationRepositoriesEventSchema", () => {
    it("should validate a valid installation_repositories event", () => {
      const result = GitHubInstallationRepositoriesEventSchema.safeParse(
        validInstallationReposPayload,
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid installation_repositories event", () => {
      const result = GitHubInstallationRepositoriesEventSchema.safeParse({
        invalid: true,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// github() Factory Tests
// ============================================================================

describe("github()", () => {
  beforeEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.WEBHOOK_SECRET;
  });

  it("should create a webhook builder", () => {
    const webhook = github();
    expect(webhook).toBeDefined();
    expect(webhook.getProvider().name).toBe("github");
  });

  it("should accept a secret option", () => {
    const webhook = github({ secret: "my-secret" });
    expect(webhook.getProvider().secret).toBe("my-secret");
  });

  it("should expose replay context from delivery header", () => {
    const provider = github().getProvider();
    const replayContext = provider.getReplayContext?.({
      "x-github-delivery": "delivery-123",
    });

    expect(replayContext).toEqual({ replayKey: "delivery-123" });
  });

  describe("event handlers", () => {
    it("should handle push events", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validPushPayload);
      const handler = vi.fn();

      const webhook = github({ secret }).event(push, handler);

      const result = await webhook.process({
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "123",
          "x-hub-signature-256": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: "refs/heads/main",
          repository: expect.objectContaining({ name: "repo" }),
        }),
        expect.objectContaining({
          eventType: "push",
          provider: "github",
        }),
      );
    });

    it("should handle pull_request events", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validPullRequestPayload);
      const handler = vi.fn();

      const webhook = github({ secret }).event(pull_request, handler);

      const result = await webhook.process({
        headers: {
          "x-github-event": "pull_request",
          "x-github-delivery": "123",
          "x-hub-signature-256": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "opened",
          pull_request: expect.objectContaining({ title: "Test PR" }),
        }),
        expect.objectContaining({
          eventType: "pull_request",
          provider: "github",
        }),
      );
    });

    it("should handle issues events", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validIssuesPayload);
      const handler = vi.fn();

      const webhook = github({ secret }).event(issues, handler);

      const result = await webhook.process({
        headers: {
          "x-github-event": "issues",
          "x-github-delivery": "123",
          "x-hub-signature-256": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "opened",
          issue: expect.objectContaining({ title: "Test Issue" }),
        }),
        expect.objectContaining({
          eventType: "issues",
          provider: "github",
        }),
      );
    });
  });

  describe("signature verification", () => {
    it("should verify valid signatures", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validPushPayload);

      const webhook = github({ secret }).event(push, () => {});

      const result = await webhook.process({
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
    });

    it("should reject invalid signatures", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validPushPayload);

      const webhook = github({ secret }).event(push, () => {});

      const result = await webhook.process({
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": "sha256=invalid",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
    });

    it("should reject missing signatures", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validPushPayload);

      const webhook = github({ secret }).event(push, () => {});

      const result = await webhook.process({
        headers: {
          "x-github-event": "push",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
    });

    it("should reject signatures with wrong prefix", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validPushPayload);

      const webhook = github({ secret }).event(push, () => {});

      const result = await webhook.process({
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": "md5=invalid",
        },
        rawBody: body,
      });

      expect(result.status).toBe(401);
    });

    it("should accept secrets accidentally prefixed with sha256=", async () => {
      const rawSecret = "test-secret";
      const prefixedSecret = `sha256=${rawSecret}`;
      const body = JSON.stringify(validPushPayload);

      const webhook = github({ secret: prefixedSecret }).event(push, () => {});

      const result = await webhook.process({
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": createSignature(body, rawSecret),
        },
        rawBody: body,
      });

      expect(result.status).toBe(200);
    });
  });

  describe("chaining", () => {
    it("should support chaining multiple events", async () => {
      const secret = "test-secret";
      const pushHandler = vi.fn();
      const prHandler = vi.fn();

      const webhook = github({ secret })
        .event(push, pushHandler)
        .event(pull_request, prHandler);

      // Test push
      const pushBody = JSON.stringify(validPushPayload);
      await webhook.process({
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": createSignature(pushBody, secret),
        },
        rawBody: pushBody,
      });

      expect(pushHandler).toHaveBeenCalled();
      expect(prHandler).not.toHaveBeenCalled();

      // Test PR
      const prBody = JSON.stringify(validPullRequestPayload);
      await webhook.process({
        headers: {
          "x-github-event": "pull_request",
          "x-hub-signature-256": createSignature(prBody, secret),
        },
        rawBody: prBody,
      });

      expect(prHandler).toHaveBeenCalled();
    });

    it("should support error handlers", async () => {
      const secret = "test-secret";
      const body = JSON.stringify(validPushPayload);
      const onError = vi.fn();

      const webhook = github({ secret })
        .event(push, () => {
          throw new Error("Test error");
        })
        .onError(onError);

      await webhook.process({
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": createSignature(body, secret),
        },
        rawBody: body,
      });

      expect(onError).toHaveBeenCalled();
    });
  });
});
