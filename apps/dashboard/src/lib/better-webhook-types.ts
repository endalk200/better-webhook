export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type WebhookProvider =
  | "stripe"
  | "github"
  | "shopify"
  | "twilio"
  | "ragie"
  | "sendgrid"
  | "slack"
  | "discord"
  | "linear"
  | "clerk"
  | "custom";

export type HeaderEntry = { key: string; value: string };

export type CapturedWebhook = {
  id: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  path: string;
  headers: Record<string, string | string[]>;
  body?: unknown;
  rawBody: string;
  query: Record<string, string | string[]>;
  provider?: WebhookProvider;
  contentType?: string;
  contentLength?: number;
};

export type CaptureFile = {
  file: string;
  capture: CapturedWebhook;
};

export type WebhookExecutionResult = {
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  body: unknown;
  bodyText: string;
  json?: unknown;
  duration: number;
};

export type TemplateMetadata = {
  id: string;
  name: string;
  description?: string;
  provider: WebhookProvider;
  event: string;
  file: string;
  version?: string;
  docsUrl?: string;
};

export type WebhookTemplate = {
  url?: string;
  method?: HttpMethod;
  headers?: HeaderEntry[];
  body?: unknown;
  provider?: WebhookProvider;
  event?: string;
  description?: string;
};

export type LocalTemplate = {
  id: string;
  metadata: TemplateMetadata;
  template: WebhookTemplate;
  downloadedAt: string;
  filePath: string;
};

export type RemoteTemplate = {
  metadata: TemplateMetadata;
  isDownloaded: boolean;
};

export type WsMessage =
  | { type: "capture"; payload: { file: string; capture: CapturedWebhook } }
  | {
      type: "captures_updated";
      payload: { captures: CaptureFile[]; count: number };
    }
  | {
      type: "templates_updated";
      payload: { local: LocalTemplate[]; remote: RemoteTemplate[] };
    }
  | { type: "replay_result"; payload: unknown }
  | { type: "error"; payload: unknown };


