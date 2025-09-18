import { Command } from "commander";
import { join, resolve, basename } from "path";
import { statSync } from "fs";
import {
  executeWebhook,
  findWebhooksDir,
  listWebhookFiles,
  loadWebhookFile,
} from "../utils/index.js";
import { WebhookDefinition } from "../schema.js";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { request } from "undici";
import { validateWebhookJSON } from "../schema.js";
import { TEMPLATE_REPO_BASE, TEMPLATES } from "../config.js";

interface RunOptions {
  url?: string;
  method?: string;
}

function statExists(p: string) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

// List subcommand
const listCommand = new Command()
  .name("list")
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

// Run subcommand
const runCommand = new Command()
  .name("run")
  .argument("<nameOrPath>", "Webhook name (in .webhooks) or path to JSON file")
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

// Download subcommand
const downloadCommand = new Command()
  .name("download")
  .argument("[name]", "Template name to download")
  .description(
    "Download official webhook template(s) into the .webhooks directory. If no name is provided, prints available templates.",
  )
  .option("-a, --all", "Download all available templates")
  .option("-f, --force", "Overwrite existing files if they exist")
  .action(
    async (
      name: string | undefined,
      opts: { all?: boolean; force?: boolean },
    ) => {
      if (name && opts.all) {
        console.error("Specify either a template name or --all, not both.");
        process.exitCode = 1;
        return;
      }

      const cwd = process.cwd();
      const dir = findWebhooksDir(cwd);
      mkdirSync(dir, { recursive: true });

      const toDownload = opts.all ? Object.keys(TEMPLATES) : name ? [name] : [];

      if (!toDownload.length) {
        console.log("Available templates:");
        for (const key of Object.keys(TEMPLATES)) console.log(` - ${key}`);
        console.log("Use: better-webhook webhooks download <name> OR --all");
        return;
      }

      for (const templateName of toDownload) {
        const rel = TEMPLATES[templateName];
        if (!rel) {
          console.error(
            `Unknown template '${templateName}'. Run without arguments to list available templates.`,
          );
          continue;
        }

        const rawUrl = `${TEMPLATE_REPO_BASE}/${rel}`;
        try {
          const { statusCode, body } = await request(rawUrl);
          if (statusCode !== 200) {
            console.error(
              `Failed to fetch ${templateName} (HTTP ${statusCode}) from ${rawUrl}`,
            );
            continue;
          }

          const text = await body.text();
          let json: any;
          try {
            json = JSON.parse(text);
          } catch (e: any) {
            console.error(
              `Invalid JSON in remote template ${templateName}: ${e.message}`,
            );
            continue;
          }
          try {
            validateWebhookJSON(json, rawUrl);
          } catch (e: any) {
            console.error(`Template failed schema validation: ${e.message}`);
            continue;
          }

          const fileName = basename(rel); // keep original filename
          const destPath = join(dir, fileName);
          if (existsSync(destPath) && !opts.force) {
            console.log(
              `Skipping existing file ${fileName} (use --force to overwrite)`,
            );
            continue;
          }
          writeFileSync(destPath, JSON.stringify(json, null, 2));
          console.log(`Downloaded ${templateName} -> .webhooks/${fileName}`);
        } catch (e: any) {
          console.error(`Error downloading ${templateName}: ${e.message}`);
        }
      }
    },
  );

// Main webhooks parent command
export const webhooks = new Command()
  .name("webhooks")
  .description("Manage and execute webhook definitions")
  .addCommand(listCommand)
  .addCommand(runCommand)
  .addCommand(downloadCommand);
