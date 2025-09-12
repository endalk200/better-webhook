#!/usr/bin/env node
import { Command } from "commander";
import { readdirSync, statSync } from "fs";
import { join, resolve, basename, extname } from "path";
import { loadWebhookFile } from "./loader.js";
import { executeWebhook } from "./http.js";
import { WebhookDefinition } from "./schema.js";

const program = new Command();

program
  .name("better-webhook")
  .description("CLI for listing and executing predefined webhooks")
  .version("0.2.0");

function findWebhooksDir(cwd: string) {
  return resolve(cwd, ".webhooks");
}

function listWebhookFiles(dir: string) {
  try {
    const entries = readdirSync(dir);
    return entries.filter(
      (e) => statSync(join(dir, e)).isFile() && extname(e) === ".json",
    );
  } catch {
    return [];
  }
}

program
  .command("list")
  .description("List available webhook JSON definitions in .webhooks directory")
  .action(() => {
    const cwd = process.cwd();
    const dir = findWebhooksDir(cwd);
    const files = listWebhookFiles(dir);
    if (!files.length) {
      console.log("No webhook definitions found in .webhooks");
      return;
    }
    files.forEach((f) => console.log(basename(f, ".json")));
  });

interface RunOptions {
  url?: string;
  method?: string;
}

program
  .command("run <nameOrPath>")
  .description(
    "Run a webhook by name (in .webhooks) or by providing a path to a JSON file",
  )
  .option("-u, --url <url>", "Override destination URL")
  .option("-m, --method <method>", "Override HTTP method")
  .action(async (nameOrPath: string, options: RunOptions) => {
    const cwd = process.cwd();
    let filePath: string;
    if (
      nameOrPath.endsWith(".json") &&
      !nameOrPath.includes("/") &&
      !nameOrPath.startsWith(".")
    ) {
      filePath = join(findWebhooksDir(cwd), nameOrPath);
    } else {
      const candidate = join(
        findWebhooksDir(cwd),
        nameOrPath + (nameOrPath.endsWith(".json") ? "" : ".json"),
      );
      if (statExists(candidate)) {
        filePath = candidate;
      } else {
        filePath = resolve(cwd, nameOrPath);
      }
    }

    if (!statExists(filePath)) {
      console.error(`Webhook file not found: ${filePath}`);
      process.exitCode = 1;
      return;
    }

    let def: WebhookDefinition;
    try {
      def = loadWebhookFile(filePath);
    } catch (err: any) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }

    if (options.url) def = { ...def, url: options.url };
    if (options.method)
      def = { ...def, method: options.method.toUpperCase() as any };

    try {
      const result = await executeWebhook(def);
      console.log("Status:", result.status);
      console.log("Headers:");
      for (const [k, v] of Object.entries(result.headers)) {
        console.log(`  ${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
      }
      if (result.json !== undefined) {
        console.log("Response JSON:");
        console.log(JSON.stringify(result.json, null, 2));
      } else {
        console.log("Response Body:");
        console.log(result.bodyText);
      }
    } catch (err: any) {
      console.error("Request failed:", err.message);
      process.exitCode = 1;
    }
  });

function statExists(p: string) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

program.parseAsync(process.argv);
