import express from "express";
import { z } from "zod";
import { TemplateManager } from "./template-manager.js";
import { ReplayEngine } from "./replay-engine.js";
import { executeTemplate } from "./executor.js";
import {
  HeaderEntrySchema,
  HttpMethodSchema,
  type HeaderEntry,
  type WebhookProvider,
  type WebSocketMessage,
} from "../types/index.js";

function jsonError(res: express.Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function getSecretEnvVarName(provider: WebhookProvider): string {
  const envVarMap: Record<WebhookProvider, string> = {
    github: "GITHUB_WEBHOOK_SECRET",
    stripe: "STRIPE_WEBHOOK_SECRET",
    shopify: "SHOPIFY_WEBHOOK_SECRET",
    twilio: "TWILIO_WEBHOOK_SECRET",
    ragie: "RAGIE_WEBHOOK_SECRET",
    slack: "SLACK_WEBHOOK_SECRET",
    linear: "LINEAR_WEBHOOK_SECRET",
    clerk: "CLERK_WEBHOOK_SECRET",
    sendgrid: "SENDGRID_WEBHOOK_SECRET",
    discord: "DISCORD_WEBHOOK_SECRET",
    custom: "WEBHOOK_SECRET",
  };
  return envVarMap[provider] || "WEBHOOK_SECRET";
}

const ReplayBodySchema = z.object({
  captureId: z.string().min(1),
  targetUrl: z.string().min(1),
  method: HttpMethodSchema.optional(),
  headers: z.array(HeaderEntrySchema).optional(),
});

const TemplateDownloadBodySchema = z.object({
  id: z.string().min(1),
});

const RunTemplateBodySchema = z.object({
  templateId: z.string().min(1),
  url: z.string().min(1),
  secret: z.string().optional(),
  headers: z.array(HeaderEntrySchema).optional(),
});

export interface DashboardApiOptions {
  capturesDir?: string;
  templatesBaseDir?: string;
  broadcast?: (message: WebSocketMessage) => void;
}

export function createDashboardApiRouter(
  options: DashboardApiOptions = {},
): express.Router {
  const router = express.Router();

  const replayEngine = new ReplayEngine(options.capturesDir);
  const templateManager = new TemplateManager(options.templatesBaseDir);
  const broadcast = options.broadcast;

  const broadcastCaptures = () => {
    if (!broadcast) return;
    const captures = replayEngine.listCaptures(200);
    broadcast({
      type: "captures_updated",
      payload: { captures, count: captures.length },
    });
  };

  const broadcastTemplates = async () => {
    if (!broadcast) return;
    const local = templateManager.listLocalTemplates();
    let remote: any[] = [];
    try {
      const index = await templateManager.fetchRemoteIndex(false);
      const localIds = new Set(local.map((t) => t.id));
      remote = index.templates.map((metadata) => ({
        metadata,
        isDownloaded: localIds.has(metadata.id),
      }));
    } catch {
      // Remote may fail offline; still notify with local templates.
      remote = [];
    }

    broadcast({
      type: "templates_updated",
      payload: { local, remote },
    });
  };

  router.get("/captures", (req, res) => {
    const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "";
    const providerRaw =
      typeof req.query.provider === "string" ? req.query.provider : "";
    const qRaw = typeof req.query.q === "string" ? req.query.q : "";

    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
    if (!Number.isFinite(limit) || limit <= 0 || limit > 5000) {
      return jsonError(res, 400, "Invalid limit");
    }

    const q = qRaw.trim();
    const provider = providerRaw.trim();

    let captures = q
      ? replayEngine.searchCaptures(q)
      : replayEngine.listCaptures(Math.max(limit, 1000));

    if (provider) {
      captures = captures.filter(
        (c) =>
          (c.capture.provider || "").toLowerCase() === provider.toLowerCase(),
      );
    }

    captures = captures.slice(0, limit);
    return res.json({ captures, count: captures.length });
  });

  router.get("/captures/:id", (req, res) => {
    const id = req.params.id;
    if (!id) {
      return jsonError(res, 400, "Missing capture id");
    }

    const captureFile = replayEngine.getCapture(id);
    if (!captureFile) {
      return jsonError(res, 404, "Capture not found");
    }

    return res.json(captureFile);
  });

  router.delete("/captures/:id", (req, res) => {
    const id = req.params.id;
    if (!id) {
      return jsonError(res, 400, "Missing capture id");
    }

    const deleted = replayEngine.deleteCapture(id);
    if (!deleted) {
      return jsonError(res, 404, "Capture not found");
    }

    broadcastCaptures();
    return res.json({ success: true });
  });

  router.delete("/captures", (_req, res) => {
    const deleted = replayEngine.deleteAllCaptures();
    broadcastCaptures();
    return res.json({ success: true, deleted });
  });

  router.post("/replay", express.json({ limit: "5mb" }), async (req, res) => {
    const parsed = ReplayBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return jsonError(
        res,
        400,
        parsed.error.issues[0]?.message || "Invalid body",
      );
    }

    const { captureId, targetUrl, method, headers } = parsed.data;

    try {
      new URL(targetUrl);
    } catch {
      return jsonError(res, 400, "Invalid targetUrl");
    }

    try {
      const result = await replayEngine.replay(captureId, {
        targetUrl,
        method,
        headers,
      });
      broadcast?.({
        type: "replay_result",
        payload: { captureId, targetUrl, result },
      });
      return res.json(result);
    } catch (error: any) {
      return jsonError(res, 400, error?.message || "Replay failed");
    }
  });

  router.get("/templates/local", (_req, res) => {
    const local = templateManager.listLocalTemplates();
    return res.json({ templates: local, count: local.length });
  });

  router.get("/templates/remote", async (req, res) => {
    const refresh =
      typeof req.query.refresh === "string"
        ? req.query.refresh === "1" ||
          req.query.refresh.toLowerCase() === "true"
        : false;

    try {
      const index = await templateManager.fetchRemoteIndex(refresh);
      const localIds = new Set(
        templateManager.listLocalTemplates().map((t) => t.id),
      );
      const remote = index.templates.map((metadata) => ({
        metadata,
        isDownloaded: localIds.has(metadata.id),
      }));
      return res.json({ templates: remote, count: remote.length });
    } catch (error: any) {
      return jsonError(
        res,
        500,
        error?.message || "Failed to fetch remote templates",
      );
    }
  });

  router.post(
    "/templates/download",
    express.json({ limit: "2mb" }),
    async (req, res) => {
      const parsed = TemplateDownloadBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return jsonError(
          res,
          400,
          parsed.error.issues[0]?.message || "Invalid body",
        );
      }

      try {
        const template = await templateManager.downloadTemplate(parsed.data.id);
        // Fire-and-forget broadcast
        void broadcastTemplates();
        return res.json({ success: true, template });
      } catch (error: any) {
        return jsonError(res, 400, error?.message || "Download failed");
      }
    },
  );

  router.post(
    "/templates/download-all",
    express.json({ limit: "1mb" }),
    async (_req, res) => {
      try {
        // "Download all" should always use the latest remote index; otherwise
        // you can miss newly-added templates until cache expiry.
        const index = await templateManager.fetchRemoteIndex(true);
        const localIds = new Set(
          templateManager.listLocalTemplates().map((t) => t.id),
        );
        const toDownload = index.templates.filter((t) => !localIds.has(t.id));

        const downloaded: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        for (const t of toDownload) {
          try {
            await templateManager.downloadTemplate(t.id);
            downloaded.push(t.id);
          } catch (e: any) {
            failed.push({ id: t.id, error: e?.message || "Failed" });
          }
        }

        return res.json({
          success: true,
          total: index.templates.length,
          downloaded,
          failed,
        });
      } catch (error: any) {
        return jsonError(res, 500, error?.message || "Download-all failed");
      }
    },
  );

  router.post("/run", express.json({ limit: "10mb" }), async (req, res) => {
    const parsed = RunTemplateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return jsonError(
        res,
        400,
        parsed.error.issues[0]?.message || "Invalid body",
      );
    }

    let { templateId, url, secret, headers } = parsed.data;

    try {
      new URL(url);
    } catch {
      return jsonError(res, 400, "Invalid url");
    }

    if (templateId.startsWith("remote:")) {
      templateId = templateId.slice("remote:".length);
      try {
        await templateManager.downloadTemplate(templateId);
      } catch (error: any) {
        return jsonError(
          res,
          400,
          error?.message || "Failed to download template",
        );
      }
    }

    let localTemplate = templateManager.getLocalTemplate(templateId);
    if (!localTemplate) {
      // Best-effort: try downloading by ID if it's in remote index.
      try {
        await templateManager.downloadTemplate(templateId);
        localTemplate = templateManager.getLocalTemplate(templateId);
      } catch {
        // ignore, handled below
      }
    }

    if (!localTemplate) {
      return jsonError(res, 404, "Template not found");
    }

    // Resolve secret: request body → env var → undefined
    if (!secret && localTemplate.metadata.provider) {
      const envVarName = getSecretEnvVarName(localTemplate.metadata.provider);
      secret = process.env[envVarName];
    }

    const safeHeaders: HeaderEntry[] | undefined = headers?.length
      ? headers
      : undefined;

    try {
      const result = await executeTemplate(localTemplate.template, {
        url,
        secret,
        headers: safeHeaders,
      });
      // Template run isn't persisted, but it's useful to notify clients anyway.
      broadcast?.({
        type: "replay_result",
        payload: { templateId, url, result },
      });
      return res.json(result);
    } catch (error: any) {
      return jsonError(res, 400, error?.message || "Run failed");
    }
  });

  return router;
}
