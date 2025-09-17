import { Command } from "commander";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { WebhookCaptureServer } from "../capture.js";
import { WebhookReplayer } from "../replay.js";
import { findCapturesDir, findWebhooksDir } from "../utils/index.js";

// List subcommand for captured webhooks
const listCommand = new Command()
  .name("list")
  .description("List captured webhook requests")
  .option("-l, --limit <limit>", "Maximum number of captures to show", "10")
  .action((options: { limit: string }) => {
    const cwd = process.cwd();
    const capturesDir = findCapturesDir(cwd);
    const replayer = new WebhookReplayer(capturesDir);

    const captures = replayer.listCaptured();
    const limit = parseInt(options.limit, 10);

    if (Number.isNaN(limit) || limit <= 0) {
      console.error("Invalid --limit: must be a positive integer.");
      process.exitCode = 1;
      return;
    }

    if (captures.length === 0) {
      console.log("No webhook captures found.");
      console.log(`Run 'better-webhook capture' to start capturing webhooks.`);
      return;
    }

    console.log(
      `📋 Found ${captures.length} captured webhooks (showing ${Math.min(limit, captures.length)}):\n`
    );

    captures.slice(0, limit).forEach(({ file, capture }) => {
      const date = new Date(capture.timestamp).toLocaleString();
      const bodySize = capture.rawBody ? capture.rawBody.length : 0;
      console.log(`🆔 ${capture.id} | 📅 ${date}`);
      console.log(`   ${capture.method} ${capture.url} | ${bodySize} bytes`);
      console.log(`   📄 ${file}\n`);
    });

    if (captures.length > limit) {
      console.log(
        `... and ${captures.length - limit} more. Use --limit to show more.`
      );
    }
  });

// Template subcommand for generating templates from captures
const templateCommand = new Command()
  .name("template")
  .argument("<captureId>", "ID of the captured webhook to create template from")
  .argument("[templateName]", "Name for the generated template")
  .description("Generate a webhook template from a captured request")
  .option(
    "-u, --url <url>",
    "Template URL (default: http://localhost:3000/webhook)"
  )
  .option("-o, --output-dir <dir>", "Output directory (default: .webhooks)")
  .action(
    async (
      captureId: string,
      templateName?: string,
      options?: { url?: string; outputDir?: string }
    ) => {
      const cwd = process.cwd();
      const capturesDir = findCapturesDir(cwd);
      const replayer = new WebhookReplayer(capturesDir);

      try {
        const template = replayer.captureToTemplate(captureId, options?.url);

        // Generate template name if not provided
        if (!templateName) {
          const capture = replayer.loadCapture(captureId);
          const date = new Date(capture.timestamp).toISOString().split("T")[0];
          const pathPart =
            capture.url.replace(/[^a-zA-Z0-9]/g, "_").substring(1) || "webhook";
          templateName = `captured_${date}_${pathPart}_${capture.id}`;
        }

        const outputDir = options?.outputDir
          ? resolve(cwd, options.outputDir)
          : findWebhooksDir(cwd);
        mkdirSync(outputDir, { recursive: true });

        const templatePath = join(outputDir, `${templateName}.json`);
        writeFileSync(templatePath, JSON.stringify(template, null, 2));

        console.log(`✅ Template created: ${templatePath}`);
        console.log(
          `🔄 Run it with: better-webhook webhooks run ${templateName}`
        );

        // Show summary of what was captured
        console.log("\n📊 Template Summary:");
        console.log(replayer.getCaptureSummary(captureId));
      } catch (error: any) {
        console.error("❌ Template generation failed:", error.message);
        process.exitCode = 1;
      }
    }
  );

// Main capture command with default action and subcommands
export const capture = new Command()
  .name("capture")
  .description(
    "Start a server to capture incoming webhook requests, or list captured webhooks"
  )
  .option("-p, --port <port>", "Port to listen on", "3001")
  .action(async (options: { port: string }) => {
    const cwd = process.cwd();
    const capturesDir = findCapturesDir(cwd);
    const server = new WebhookCaptureServer(capturesDir);

    let actualPort: number;
    try {
      actualPort = await server.start(parseInt(options.port));
    } catch (error: any) {
      console.error("Failed to start capture server:", error.message);
      process.exitCode = 1;
      return;
    }

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("\n🛑 Shutting down server...");
      await server.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .addCommand(listCommand)
  .addCommand(templateCommand);
