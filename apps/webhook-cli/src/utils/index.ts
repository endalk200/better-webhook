import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve, extname } from "path";
import { validateWebhookJSON, WebhookDefinition } from "../schema.js";

export function findWebhooksDir(cwd: string) {
  return resolve(cwd, ".webhooks");
}

export function listWebhookFiles(dir: string) {
  return listJsonFiles(dir);
}

export function findCapturesDir(cwd: string) {
  return resolve(cwd, ".webhook-captures");
}

export function listJsonFiles(dir: string) {
  try {
    const entries = readdirSync(dir);
    return entries.filter(
      (e) => statSync(join(dir, e)).isFile() && extname(e) === ".json",
    );
  } catch {
    return [];
  }
}

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

export { executeWebhook, type ExecutionResult } from "./http.js";
