import { z } from "zod";

export const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const HeaderEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export type HeaderEntry = z.infer<typeof HeaderEntrySchema>;

export const WebhookProviderSchema = z.enum([
  "stripe",
  "github",
  "shopify",
  "twilio",
  "ragie",
  "sendgrid",
  "slack",
  "discord",
  "linear",
  "clerk",
  "custom",
]);

export type WebhookProvider = z.infer<typeof WebhookProviderSchema>;

export const TemplateMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  provider: WebhookProviderSchema,
  event: z.string(),
  file: z.string(),
  version: z.string().optional(),
  docsUrl: z.string().url().optional(),
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

export const TemplatesIndexSchema = z.object({
  version: z.string(),
  templates: z.array(TemplateMetadataSchema),
});

export type TemplatesIndex = z.infer<typeof TemplatesIndexSchema>;

export const WebhookTemplateSchema = z.object({
  url: z.string().url().optional(),
  method: HttpMethodSchema.default("POST"),
  headers: z.array(HeaderEntrySchema).default([]),
  body: z.any().optional(),
  provider: WebhookProviderSchema.optional(),
  event: z.string().optional(),
  description: z.string().optional(),
});

export type WebhookTemplate = z.infer<typeof WebhookTemplateSchema>;

export interface LocalTemplate {
  id: string;
  metadata: TemplateMetadata;
  template: WebhookTemplate;
  downloadedAt: string;
  filePath: string;
}

export interface RemoteTemplate {
  metadata: TemplateMetadata;
  isDownloaded: boolean;
}

export const CapturedWebhookSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  method: HttpMethodSchema,
  url: z.string(),
  path: z.string(),
  headers: z.record(z.union([z.string(), z.array(z.string())])),
  body: z.any().optional(),
  rawBody: z.string(),
  query: z.record(z.union([z.string(), z.array(z.string())])),
  provider: WebhookProviderSchema.optional(),
  contentType: z.string().optional(),
  contentLength: z.number().optional(),
});

export type CapturedWebhook = z.infer<typeof CapturedWebhookSchema>;

export interface CaptureFile {
  file: string;
  capture: CapturedWebhook;
}

export interface WebhookExecutionOptions {
  url: string;
  method?: HttpMethod;
  headers?: HeaderEntry[];
  body?: unknown;
  secret?: string;
  provider?: WebhookProvider;
  timeout?: number;
}

export interface WebhookExecutionResult {
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  body: unknown;
  bodyText: string;
  json?: unknown;
  duration: number;
}

export interface ReplayOptions {
  targetUrl: string;
  method?: HttpMethod;
  headers?: HeaderEntry[];
}

export const ConfigSchema = z.object({
  version: z.string().default("2.0.0"),
  templatesDir: z.string().optional(),
  capturesDir: z.string().optional(),
  defaultTargetUrl: z.string().url().optional(),
  secrets: z
    .record(z.string())
    .optional()
    .describe("Provider secrets for signature generation"),
  dashboard: z
    .object({
      port: z.number().default(4000),
      host: z.string().default("localhost"),
    })
    .optional(),
  capture: z
    .object({
      port: z.number().default(3001),
      host: z.string().default("0.0.0.0"),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface DashboardState {
  templates: {
    remote: RemoteTemplate[];
    local: LocalTemplate[];
  };
  captures: CaptureFile[];
  config: Config;
}

export interface WebSocketMessage {
  type:
    | "capture"
    | "templates_updated"
    | "captures_updated"
    | "replay_result"
    | "error";
  payload: unknown;
}

export interface SignatureOptions {
  provider: WebhookProvider;
  payload: string;
  secret: string;
  timestamp?: number;
}

export interface GeneratedSignature {
  header: string;
  value: string;
}

export interface SaveAsTemplateOptions {
  id?: string;
  name?: string;
  event?: string;
  description?: string;
  url?: string;
  overwrite?: boolean;
}

export interface SaveAsTemplateResult {
  id: string;
  filePath: string;
  template: WebhookTemplate;
}
