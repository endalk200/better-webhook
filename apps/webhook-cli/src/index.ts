#!/usr/bin/env node
import { Command } from "commander";
import {
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "fs";
import { join, resolve, basename, extname } from "path";
import { loadWebhookFile } from "./loader.js";
import { executeWebhook } from "./http.js";
import { WebhookDefinition, validateWebhookJSON } from "./schema.js";
import { request } from "undici";

const program = new Command();

program
  .name("better-webhook")
  .description("CLI for listing, downloading and executing predefined webhooks")
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

// Remote template index (expand over time)
const TEMPLATE_REPO_BASE =
  "https://raw.githubusercontent.com/endalk200/better-webhook/main";
const TEMPLATES: Record<string, string> = {
  "stripe-invoice.payment_succeeded":
    "templates/stripe-invoice.payment_succeeded.json",
};

program
  .command("download [name]")
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
        console.log("Use: better-webhook download <name> OR --all");
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
