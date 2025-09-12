import { request } from "undici";
import { WebhookDefinition } from "./schema.js";

export interface ExecutionResult {
  status: number;
  headers: Record<string, string | string[]>;
  bodyText: string;
  json?: any;
}

export async function executeWebhook(
  def: WebhookDefinition,
): Promise<ExecutionResult> {
  const headerMap: Record<string, string> = {};
  for (const h of def.headers) {
    headerMap[h.key] = h.value;
  }
  if (!headerMap["content-type"] && def.body !== undefined) {
    headerMap["content-type"] = "application/json";
  }

  const bodyPayload =
    def.body !== undefined ? JSON.stringify(def.body) : undefined;

  const { statusCode, headers, body } = await request(def.url, {
    method: def.method,
    headers: headerMap,
    body: bodyPayload,
  });
  const text = await body.text();
  let parsed: any;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
  }
  const resultHeaders: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(headers)) {
    resultHeaders[k] = v as any;
  }
  return {
    status: statusCode,
    headers: resultHeaders,
    bodyText: text,
    json: parsed,
  };
}
