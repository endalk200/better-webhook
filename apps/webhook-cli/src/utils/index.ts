import { readdirSync, statSync } from "fs";
import { join, resolve, extname } from "path";

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
      (e) => statSync(join(dir, e)).isFile() && extname(e) === ".json"
    );
  } catch {
    return [];
  }
}
