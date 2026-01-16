import { Command } from "commander";
import chalk from "chalk";
import prompts from "prompts";
import { homedir } from "os";
import { getReplayEngine } from "../core/replay-engine.js";
import { getTemplateManager } from "../core/template-manager.js";

function toRelativePath(absolutePath: string): string {
  const home = homedir();
  if (absolutePath.startsWith(home)) {
    return "~" + absolutePath.slice(home.length);
  }
  return absolutePath;
}

/**
 * List captured webhooks
 */
const listCommand = new Command()
  .name("list")
  .alias("ls")
  .description("List captured webhooks")
  .option("-l, --limit <limit>", "Maximum number of captures to show", "20")
  .option("-p, --provider <provider>", "Filter by provider")
  .action((options: { limit: string; provider?: string }) => {
    const limit = parseInt(options.limit, 10);

    if (isNaN(limit) || limit <= 0) {
      console.error(chalk.red("Invalid limit value"));
      process.exitCode = 1;
      return;
    }

    const engine = getReplayEngine();
    let captures = engine.listCaptures(limit);

    if (options.provider) {
      captures = captures.filter(
        (c) =>
          c.capture.provider?.toLowerCase() === options.provider?.toLowerCase(),
      );
    }

    if (captures.length === 0) {
      console.log(chalk.yellow("\n📭 No captured webhooks found."));
      console.log(
        chalk.gray("   Start capturing with: better-webhook capture\n"),
      );
      return;
    }

    console.log(chalk.bold("\n📦 Captured Webhooks\n"));

    for (const { file, capture } of captures) {
      const date = new Date(capture.timestamp).toLocaleString();
      const provider = capture.provider
        ? chalk.cyan(`[${capture.provider}]`)
        : chalk.gray("[unknown]");
      const size = capture.contentLength || capture.rawBody?.length || 0;

      console.log(`  ${chalk.white(capture.id.slice(0, 8))} ${provider}`);
      console.log(chalk.gray(`    ${capture.method} ${capture.path}`));
      console.log(chalk.gray(`    ${date} | ${size} bytes`));
      console.log(chalk.gray(`    File: ${file}`));
      console.log();
    }

    console.log(chalk.gray(`  Showing ${captures.length} captures`));
    console.log(chalk.gray(`  Storage: ${engine.getCapturesDir()}\n`));
  });

/**
 * Show capture details
 */
const showCommand = new Command()
  .name("show")
  .argument("<captureId>", "Capture ID or partial ID")
  .description("Show detailed information about a capture")
  .option("-b, --body", "Show full body content")
  .action((captureId: string, options: { body?: boolean }) => {
    const engine = getReplayEngine();
    const captureFile = engine.getCapture(captureId);

    if (!captureFile) {
      console.log(chalk.red(`\n❌ Capture not found: ${captureId}\n`));
      process.exitCode = 1;
      return;
    }

    const { capture } = captureFile;

    console.log(chalk.bold("\n📋 Capture Details\n"));
    console.log(`  ${chalk.gray("ID:")} ${capture.id}`);
    console.log(`  ${chalk.gray("File:")} ${captureFile.file}`);
    console.log(
      `  ${chalk.gray("Timestamp:")} ${new Date(capture.timestamp).toLocaleString()}`,
    );
    console.log(`  ${chalk.gray("Method:")} ${capture.method}`);
    console.log(`  ${chalk.gray("Path:")} ${capture.path}`);
    console.log(`  ${chalk.gray("URL:")} ${capture.url}`);

    if (capture.provider) {
      console.log(
        `  ${chalk.gray("Provider:")} ${chalk.cyan(capture.provider)}`,
      );
    }

    console.log(
      `  ${chalk.gray("Content-Type:")} ${capture.contentType || "unknown"}`,
    );
    console.log(
      `  ${chalk.gray("Content-Length:")} ${capture.contentLength || 0} bytes`,
    );

    // Query params
    const queryKeys = Object.keys(capture.query);
    if (queryKeys.length > 0) {
      console.log(chalk.bold("\n  Query Parameters:"));
      for (const [key, value] of Object.entries(capture.query)) {
        const queryValue = Array.isArray(value) ? value.join(", ") : value;
        console.log(chalk.gray(`    ${key}: ${queryValue}`));
      }
    }

    // Headers
    console.log(chalk.bold("\n  Headers:"));
    for (const [key, value] of Object.entries(capture.headers)) {
      const headerValue = Array.isArray(value) ? value.join(", ") : value;
      // Truncate long header values
      const display =
        headerValue.length > 80
          ? headerValue.slice(0, 80) + "..."
          : headerValue;
      console.log(chalk.gray(`    ${key}: ${display}`));
    }

    // Body
    if (options.body && capture.body) {
      console.log(chalk.bold("\n  Body:"));
      if (typeof capture.body === "object") {
        console.log(
          chalk.gray(
            JSON.stringify(capture.body, null, 2)
              .split("\n")
              .map((l) => `    ${l}`)
              .join("\n"),
          ),
        );
      } else {
        console.log(chalk.gray(`    ${capture.body}`));
      }
    } else if (capture.body) {
      console.log(chalk.bold("\n  Body:"));
      const preview = JSON.stringify(capture.body).slice(0, 200);
      console.log(
        chalk.gray(`    ${preview}${preview.length >= 200 ? "..." : ""}`),
      );
      console.log(chalk.gray("    Use --body to see full content"));
    }

    console.log();
  });

/**
 * Search captures
 */
const searchCommand = new Command()
  .name("search")
  .argument("<query>", "Search query")
  .description("Search captures by path, method, or provider")
  .action((query: string) => {
    const engine = getReplayEngine();
    const results = engine.searchCaptures(query);

    if (results.length === 0) {
      console.log(chalk.yellow(`\n📭 No captures found for: "${query}"\n`));
      return;
    }

    console.log(chalk.bold(`\n🔍 Search Results for "${query}"\n`));

    for (const { file, capture } of results) {
      const date = new Date(capture.timestamp).toLocaleString();
      const provider = capture.provider
        ? chalk.cyan(`[${capture.provider}]`)
        : "";

      console.log(`  ${chalk.white(capture.id.slice(0, 8))} ${provider}`);
      console.log(chalk.gray(`    ${capture.method} ${capture.path}`));
      console.log(chalk.gray(`    ${date}`));
      console.log();
    }

    console.log(chalk.gray(`  Found: ${results.length} captures\n`));
  });

/**
 * Delete a specific capture
 */
const deleteCommand = new Command()
  .name("delete")
  .alias("rm")
  .argument("<captureId>", "Capture ID or partial ID to delete")
  .description("Delete a specific captured webhook")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (captureId: string, options: { force?: boolean }) => {
    const engine = getReplayEngine();
    const captureFile = engine.getCapture(captureId);

    if (!captureFile) {
      console.log(chalk.red(`\n❌ Capture not found: ${captureId}\n`));
      process.exitCode = 1;
      return;
    }

    const { capture } = captureFile;

    if (!options.force) {
      console.log(chalk.bold("\n🗑️  Capture to delete:\n"));
      console.log(`    ${chalk.white(capture.id.slice(0, 8))}`);
      console.log(chalk.gray(`    ${capture.method} ${capture.path}`));
      console.log(
        chalk.gray(`    ${new Date(capture.timestamp).toLocaleString()}`),
      );
      console.log();

      const response = await prompts({
        type: "confirm",
        name: "confirm",
        message: "Delete this capture?",
        initial: false,
      });

      if (!response.confirm) {
        console.log(chalk.yellow("Cancelled"));
        return;
      }
    }

    const deleted = engine.deleteCapture(captureId);
    if (deleted) {
      console.log(
        chalk.green(`\n✓ Deleted capture: ${capture.id.slice(0, 8)}\n`),
      );
    } else {
      console.log(chalk.red(`\n❌ Failed to delete capture\n`));
      process.exitCode = 1;
    }
  });

/**
 * Clean/remove all captures
 */
const cleanCommand = new Command()
  .name("clean")
  .alias("remove-all")
  .description("Remove all captured webhooks")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (options: { force?: boolean }) => {
    const engine = getReplayEngine();
    const captures = engine.listCaptures(10000);

    if (captures.length === 0) {
      console.log(chalk.yellow("\n📭 No captures to remove.\n"));
      return;
    }

    console.log(
      chalk.bold(`\n🗑️  Found ${captures.length} captured webhook(s)\n`),
    );

    // Show summary by provider
    const byProvider = new Map<string, number>();
    for (const c of captures) {
      const provider = c.capture.provider || "unknown";
      byProvider.set(provider, (byProvider.get(provider) || 0) + 1);
    }

    for (const [provider, count] of byProvider) {
      console.log(chalk.gray(`    ${provider}: ${count}`));
    }
    console.log();

    if (!options.force) {
      const response = await prompts({
        type: "confirm",
        name: "confirm",
        message: `Delete all ${captures.length} capture(s)?`,
        initial: false,
      });

      if (!response.confirm) {
        console.log(chalk.yellow("Cancelled"));
        return;
      }
    }

    const deleted = engine.deleteAllCaptures();
    console.log(chalk.green(`\n✓ Removed ${deleted} capture(s)`));
    console.log(chalk.gray(`  Storage: ${engine.getCapturesDir()}\n`));
  });

/**
 * Save a capture as a reusable template
 */
const saveAsTemplateCommand = new Command()
  .name("save-as-template")
  .alias("sat")
  .argument("<captureId>", "Capture ID or partial ID")
  .description("Save a captured webhook as a reusable template")
  .option("--id <id>", "Template ID (auto-generated if not provided)")
  .option("--name <name>", "Template display name")
  .option("--event <event>", "Event type (auto-detected if not provided)")
  .option("--description <description>", "Template description")
  .option("--url <url>", "Default target URL for the template")
  .option("--overwrite", "Overwrite existing template with same ID")
  .action(
    async (
      captureId: string,
      options: {
        id?: string;
        name?: string;
        event?: string;
        description?: string;
        url?: string;
        overwrite?: boolean;
      },
    ) => {
      const engine = getReplayEngine();
      const templateManager = getTemplateManager();

      // Get the capture
      const captureFile = engine.getCapture(captureId);
      if (!captureFile) {
        console.log(chalk.red(`\n❌ Capture not found: ${captureId}\n`));
        process.exitCode = 1;
        return;
      }

      const { capture } = captureFile;

      // Show capture info
      console.log(chalk.bold("\n📋 Capture to save as template:\n"));
      console.log(`    ${chalk.white(capture.id.slice(0, 8))}`);
      console.log(chalk.gray(`    ${capture.method} ${capture.path}`));
      if (capture.provider) {
        console.log(chalk.gray(`    Provider: ${capture.provider}`));
      }
      console.log();

      // Convert capture to template
      const template = engine.captureToTemplate(captureId, {
        url: options.url,
        event: options.event,
      });

      // If no ID provided, prompt interactively
      let templateId = options.id;
      if (!templateId) {
        const suggestedId =
          `${capture.provider || "custom"}-${template.event || "webhook"}`
            .toLowerCase()
            .replace(/\s+/g, "-");

        const response = await prompts({
          type: "text",
          name: "templateId",
          message: "Template ID:",
          initial: suggestedId,
          validate: (value) =>
            value.trim().length > 0 || "Template ID is required",
        });

        if (!response.templateId) {
          console.log(chalk.yellow("Cancelled"));
          return;
        }
        templateId = response.templateId;
      }

      // Check for existing template
      if (
        !options.overwrite &&
        templateId &&
        templateManager.templateExists(templateId)
      ) {
        const response = await prompts({
          type: "confirm",
          name: "overwrite",
          message: `Template "${templateId}" already exists. Overwrite?`,
          initial: false,
        });

        if (!response.overwrite) {
          console.log(chalk.yellow("Cancelled"));
          return;
        }
        options.overwrite = true;
      }

      try {
        const result = templateManager.saveUserTemplate(template, {
          id: templateId,
          name: options.name,
          event: options.event || template.event,
          description: options.description,
          overwrite: options.overwrite,
        });

        console.log(chalk.green(`\n✓ Saved template: ${result.id}`));
        console.log(chalk.gray(`  File: ${toRelativePath(result.filePath)}`));
        console.log(chalk.gray(`  Provider: ${template.provider || "custom"}`));
        if (template.event) {
          console.log(chalk.gray(`  Event: ${template.event}`));
        }
        console.log();
        console.log(chalk.gray("  Run it with:"));
        console.log(
          chalk.cyan(
            `    better-webhook run ${result.id} --url http://localhost:3000/webhooks\n`,
          ),
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to save template";
        console.log(chalk.red(`\n❌ ${message}\n`));
        process.exitCode = 1;
      }
    },
  );

/**
 * Main captures command
 */
export const captures = new Command()
  .name("captures")
  .alias("c")
  .description("Manage captured webhooks")
  .addCommand(listCommand)
  .addCommand(showCommand)
  .addCommand(searchCommand)
  .addCommand(deleteCommand)
  .addCommand(cleanCommand)
  .addCommand(saveAsTemplateCommand);
