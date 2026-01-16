import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { TemplateManager } from "./template-manager.js";
import type { WebhookTemplate } from "../types/index.js";

describe("TemplateManager", () => {
  let tempDir: string;
  let manager: TemplateManager;

  beforeEach(() => {
    tempDir = join(tmpdir(), `better-webhook-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    manager = new TemplateManager(tempDir);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("templateExists", () => {
    it("should return false when template does not exist", () => {
      expect(manager.templateExists("non-existent")).toBe(false);
    });

    it("should return true when template exists", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: { test: true },
        provider: "github",
        event: "push",
      };

      manager.saveUserTemplate(template, { id: "test-template" });
      expect(manager.templateExists("test-template")).toBe(true);
    });
  });

  describe("saveUserTemplate", () => {
    it("should save a template with explicit ID", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [{ key: "content-type", value: "application/json" }],
        body: { action: "created" },
        provider: "github",
        event: "push",
      };

      const result = manager.saveUserTemplate(template, {
        id: "my-template",
        name: "My Template",
        description: "A test template",
      });

      expect(result.id).toBe("my-template");
      expect(result.filePath).toContain("my-template.json");
      expect(existsSync(result.filePath)).toBe(true);

      const saved = JSON.parse(readFileSync(result.filePath, "utf-8"));
      expect(saved._metadata.id).toBe("my-template");
      expect(saved._metadata.name).toBe("My Template");
      expect(saved._metadata.description).toBe("A test template");
      expect(saved._metadata.source).toBe("capture");
      expect(saved._metadata.provider).toBe("github");
      expect(saved._metadata.event).toBe("push");
    });

    it("should auto-generate ID from provider and event", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
        provider: "stripe",
        event: "payment.succeeded",
      };

      const result = manager.saveUserTemplate(template);

      expect(result.id).toBe("stripe-payment.succeeded");
    });

    it("should generate unique ID when base ID already exists", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
        provider: "github",
        event: "push",
      };

      const result1 = manager.saveUserTemplate(template);
      expect(result1.id).toBe("github-push");

      const result2 = manager.saveUserTemplate(template);
      expect(result2.id).toBe("github-push-1");

      const result3 = manager.saveUserTemplate(template);
      expect(result3.id).toBe("github-push-2");
    });

    it("should throw error when template exists and overwrite is false", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
      };

      manager.saveUserTemplate(template, { id: "existing-template" });

      expect(() => {
        manager.saveUserTemplate(template, { id: "existing-template" });
      }).toThrow('Template with ID "existing-template" already exists');
    });

    it("should overwrite when overwrite option is true", () => {
      const template1: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: { version: 1 },
      };

      const template2: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: { version: 2 },
      };

      manager.saveUserTemplate(template1, { id: "my-template" });
      const result = manager.saveUserTemplate(template2, {
        id: "my-template",
        overwrite: true,
      });

      const saved = JSON.parse(readFileSync(result.filePath, "utf-8"));
      expect(saved.body.version).toBe(2);
    });

    it("should use custom provider as default", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
      };

      const result = manager.saveUserTemplate(template);

      expect(result.id).toBe("custom-webhook");
      const saved = JSON.parse(readFileSync(result.filePath, "utf-8"));
      expect(saved._metadata.provider).toBe("custom");
    });

    it("should use event option over template event", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
        provider: "github",
        event: "push",
      };

      const result = manager.saveUserTemplate(template, {
        event: "pull_request",
      });

      expect(result.id).toBe("github-pull_request");
      const saved = JSON.parse(readFileSync(result.filePath, "utf-8"));
      expect(saved._metadata.event).toBe("pull_request");
    });

    it("should create provider subdirectory", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
        provider: "slack",
        event: "message",
      };

      const result = manager.saveUserTemplate(template);

      expect(result.filePath).toContain("slack");
      expect(existsSync(join(tempDir, "templates", "slack"))).toBe(true);
    });

    it("should include createdAt in metadata", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
      };

      const beforeSave = new Date();
      const result = manager.saveUserTemplate(template, { id: "test" });
      const afterSave = new Date();

      const saved = JSON.parse(readFileSync(result.filePath, "utf-8"));
      const createdAt = new Date(saved._metadata.createdAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });
  });

  describe("integration with listLocalTemplates", () => {
    it("should list saved user templates", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: { test: true },
        provider: "github",
        event: "push",
      };

      manager.saveUserTemplate(template, {
        id: "user-template",
        name: "User Template",
      });

      const templates = manager.listLocalTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0]!.id).toBe("user-template");
      expect(templates[0]!.metadata.name).toBe("User Template");
      expect((templates[0]!.metadata as Record<string, unknown>).source).toBe(
        "capture",
      );
    });
  });

  describe("integration with getLocalTemplate", () => {
    it("should retrieve saved user template by ID", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [{ key: "x-custom", value: "test" }],
        body: { data: "value" },
        provider: "stripe",
        event: "invoice.paid",
      };

      manager.saveUserTemplate(template, { id: "stripe-test" });

      const retrieved = manager.getLocalTemplate("stripe-test");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe("stripe-test");
      expect(retrieved!.template.body).toEqual({ data: "value" });
      expect(retrieved!.template.headers).toEqual([
        { key: "x-custom", value: "test" },
      ]);
    });
  });

  describe("integration with deleteLocalTemplate", () => {
    it("should delete saved user template", () => {
      const template: WebhookTemplate = {
        url: "http://localhost:3000/webhooks",
        method: "POST",
        headers: [],
        body: {},
      };

      manager.saveUserTemplate(template, { id: "to-delete" });
      expect(manager.templateExists("to-delete")).toBe(true);

      const deleted = manager.deleteLocalTemplate("to-delete");
      expect(deleted).toBe(true);
      expect(manager.templateExists("to-delete")).toBe(false);
    });
  });
});
