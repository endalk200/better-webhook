import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";
import chalk from "chalk";
import { getReplayEngine } from "../core/replay-engine.js";
import type { HeaderEntry } from "../types/index.js";

export const replay = new Command()
  .name("replay")
  .argument("[captureId]", "Capture ID to replay")
  .argument("[targetUrl]", "Target URL to replay to")
  .description("Replay a captured webhook to a target URL")
  .option("-m, --method <method>", "Override HTTP method")
  .option(
    "-H, --header <header>",
    "Add or override header (format: key:value)",
    (value: string, previous: HeaderEntry[]) => {
      const [key, ...valueParts] = value.split(":");
      const headerValue = valueParts.join(":");
      if (!key || !headerValue) {
        throw new Error("Header format should be key:value");
      }
      return (previous || []).concat([
        { key: key.trim(), value: headerValue.trim() },
      ]);
    },
    [] as HeaderEntry[],
  )
  .option("-v, --verbose", "Show detailed request/response information")
  .action(
    async (
      captureId?: string,
      targetUrl?: string,
      options?: {
        method?: string;
        header?: HeaderEntry[];
        verbose?: boolean;
      },
    ) => {
      const engine = getReplayEngine();

      // Interactive selection if no captureId provided
      if (!captureId) {
        const captures = engine.listCaptures(50);

        if (captures.length === 0) {
          console.log(chalk.yellow("\n📭 No captured webhooks found."));
          console.log(
            chalk.gray("   Start capturing with: better-webhook capture\n"),
          );
          return;
        }

        const choices = captures.map((c) => {
          const date = new Date(c.capture.timestamp).toLocaleString();
          const provider = c.capture.provider ? `[${c.capture.provider}]` : "";
          return {
            title: `${c.capture.id.slice(0, 8)} ${provider} ${c.capture.method} ${c.capture.path}`,
            description: date,
            value: c.capture.id,
          };
        });

        const response = await prompts({
          type: "select",
          name: "captureId",
          message: "Select a capture to replay:",
          choices,
        });

        if (!response.captureId) {
          console.log(chalk.yellow("Cancelled"));
          return;
        }

        captureId = response.captureId;
      }

      // Verify capture exists
      const captureFile = engine.getCapture(captureId!);
      if (!captureFile) {
        console.log(chalk.red(`\n❌ Capture not found: ${captureId}\n`));
        process.exitCode = 1;
        return;
      }

      // Get target URL
      if (!targetUrl) {
        const response = await prompts({
          type: "text",
          name: "url",
          message: "Enter target URL:",
          initial: `http://localhost:3000${captureFile.capture.path}`,
          validate: (value) => {
            try {
              new URL(value);
              return true;
            } catch {
              return "Please enter a valid URL";
            }
          },
        });

        if (!response.url) {
          console.log(chalk.yellow("Cancelled"));
          return;
        }

        targetUrl = response.url;
      }

      // Show info
      const { capture } = captureFile;
      console.log(chalk.bold("\n🔄 Replaying Webhook\n"));
      console.log(chalk.gray(`   Capture ID: ${capture.id.slice(0, 8)}`));
      console.log(chalk.gray(`   Original: ${capture.method} ${capture.path}`));
      if (capture.provider) {
        console.log(chalk.gray(`   Provider: ${capture.provider}`));
      }
      console.log(chalk.gray(`   Target: ${targetUrl}`));
      console.log();

      // Execute replay
      const spinner = ora("Replaying webhook...").start();

      try {
        const result = await engine.replay(captureId!, {
          targetUrl: targetUrl!,
          method: options?.method as any,
          headers: options?.header,
        });

        spinner.stop();

        // Show result
        const statusColor =
          result.status >= 200 && result.status < 300
            ? chalk.green
            : result.status >= 400
              ? chalk.red
              : chalk.yellow;

        console.log(chalk.bold("📥 Response\n"));
        console.log(
          `   Status: ${statusColor(`${result.status} ${result.statusText}`)}`,
        );
        console.log(`   Duration: ${chalk.cyan(`${result.duration}ms`)}`);

        if (options?.verbose) {
          console.log(chalk.bold("\n   Headers:"));
          for (const [key, value] of Object.entries(result.headers)) {
            const headerValue = Array.isArray(value) ? value.join(", ") : value;
            console.log(chalk.gray(`     ${key}: ${headerValue}`));
          }
        }

        if (result.json !== undefined) {
          console.log(chalk.bold("\n   Body:"));
          console.log(
            chalk.gray(
              JSON.stringify(result.json, null, 2)
                .split("\n")
                .map((l) => `     ${l}`)
                .join("\n"),
            ),
          );
        } else if (result.bodyText) {
          console.log(chalk.bold("\n   Body:"));
          const preview =
            result.bodyText.length > 500
              ? result.bodyText.slice(0, 500) + "..."
              : result.bodyText;
          console.log(chalk.gray(`     ${preview}`));
        }

        console.log();

        if (result.status >= 200 && result.status < 300) {
          console.log(chalk.green("✓ Replay completed successfully\n"));
        } else {
          console.log(
            chalk.yellow(`⚠ Replay completed with status ${result.status}\n`),
          );
        }
      } catch (error: any) {
        spinner.fail("Replay failed");
        console.error(chalk.red(`\n❌ ${error.message}\n`));
        process.exitCode = 1;
      }
    },
  );
