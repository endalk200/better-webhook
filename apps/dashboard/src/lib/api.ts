import type {
  CaptureFile,
  HeaderEntry,
  LocalTemplate,
  RemoteTemplate,
  WebhookExecutionResult,
} from "@/lib/better-webhook-types";

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message =
      (data &&
        typeof data === "object" &&
        "error" in data &&
        (data as { error: unknown }).error) ||
      res.statusText ||
      "Request failed";
    throw new Error(String(message));
  }

  return data as T;
}

export async function health(): Promise<{ ok: boolean }> {
  return apiFetch("/health");
}

export async function listCaptures(params?: {
  limit?: number;
  provider?: string;
  q?: string;
}): Promise<{ captures: CaptureFile[]; count: number }> {
  const usp = new URLSearchParams();
  if (params?.limit) usp.set("limit", String(params.limit));
  if (params?.provider) usp.set("provider", params.provider);
  if (params?.q) usp.set("q", params.q);
  const qs = usp.toString();
  return apiFetch(`/api/captures${qs ? `?${qs}` : ""}`);
}

export async function getCapture(id: string): Promise<CaptureFile> {
  return apiFetch(`/api/captures/${encodeURIComponent(id)}`);
}

export async function deleteCapture(id: string): Promise<{ success: true }> {
  return apiFetch(`/api/captures/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function deleteAllCaptures(): Promise<{
  success: true;
  deleted: number;
}> {
  return apiFetch(`/api/captures`, { method: "DELETE" });
}

export async function replayCapture(args: {
  captureId: string;
  targetUrl: string;
  method?: string;
  headers?: HeaderEntry[];
}): Promise<WebhookExecutionResult> {
  return apiFetch(`/api/replay`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function listLocalTemplates(): Promise<{
  templates: LocalTemplate[];
  count: number;
}> {
  return apiFetch(`/api/templates/local`);
}

export async function listRemoteTemplates(params?: {
  refresh?: boolean;
}): Promise<{ templates: RemoteTemplate[]; count: number }> {
  const qs = params?.refresh ? "?refresh=true" : "";
  return apiFetch(`/api/templates/remote${qs}`);
}

export async function downloadTemplate(id: string): Promise<{
  success: true;
  template: LocalTemplate;
}> {
  return apiFetch(`/api/templates/download`, {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export async function downloadAllTemplates(): Promise<{
  success: true;
  total: number;
  downloaded: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  return apiFetch(`/api/templates/download-all`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function runTemplate(args: {
  templateId: string;
  url: string;
  secret?: string;
  headers?: HeaderEntry[];
}): Promise<WebhookExecutionResult> {
  return apiFetch(`/api/run`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function saveAsTemplate(args: {
  captureId: string;
  id?: string;
  name?: string;
  event?: string;
  description?: string;
  url?: string;
  overwrite?: boolean;
}): Promise<{
  success: true;
  id: string;
  filePath: string;
  template: unknown;
}> {
  return apiFetch(`/api/templates/from-capture`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}
