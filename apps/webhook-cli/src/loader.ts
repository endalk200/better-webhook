import { readFileSync } from "fs";
import { validateWebhookJSON, WebhookDefinition } from "./schema.js";

export function loadWebhookFile(path: string): WebhookDefinition {
  let rawContent: string;
  try {
    rawContent = readFileSync(path, "utf8");
  } catch (e: any) {
    throw new Error(`Failed to read file ${path}: ${e.message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(rawContent);
  } catch (e: any) {
    throw new Error(`Invalid JSON in file ${path}: ${e.message}`);
  }
  return validateWebhookJSON(json, path);
}
