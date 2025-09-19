import { Command } from "commander";
import { WebhookReplayer } from "../replay.js";
import { findCapturesDir } from "../utils/index.js";
import prompts from "prompts";
import ora from "ora";

export const replay = new Command()
  .name("replay")
  .argument(
    "[captureId]",
    "ID of the captured webhook to replay (optional - will prompt if not provided)"
  )
  .argument(
    "[targetUrl]",
    "Target URL to replay the webhook to (optional - will prompt if not provided)"
  )
  .description("Replay a captured webhook to a target URL")
  .option("-m, --method <method>", "Override HTTP method")
  .option(
    "-H, --header <header>",
    "Add custom header (format: key:value)",
    (value, previous: Array<{ key: string; value: string }>) => {
      const [key, ...valueParts] = value.split(":");
      const headerValue = valueParts.join(":");
      if (!key || !headerValue) {
        throw new Error("Header format should be key:value");
      }
      return (previous || []).concat([
        { key: key.trim(), value: headerValue.trim() },
      ]);
    },
    [] as Array<{ key: string; value: string }>
  )
  .action(
    async (
      captureId?: string,
      targetUrl?: string,
      options: {
        method?: string;
        header?: Array<{ key: string; value: string }>;
      } = {}
    ) => {
      const cwd = process.cwd();
      const capturesDir = findCapturesDir(cwd);
      const replayer = new WebhookReplayer(capturesDir);

      // Get list of captured webhooks
      const spinner = ora("Loading captured webhooks...").start();
      const captured = replayer.listCaptured();
      spinner.stop();

      if (captured.length === 0) {
        console.log("📭 No captured webhooks found.");
        console.log(
          "💡 Run 'better-webhook capture' to start capturing webhooks first."
        );
        return;
      }

      let selectedCaptureId = captureId;
      let selectedTargetUrl = targetUrl;

      // Prompt for capture selection if not provided
      if (!selectedCaptureId) {
        const choices = captured.map((c) => {
          const date = new Date(c.capture.timestamp).toLocaleString();
          const bodySize = c.capture.rawBody?.length ?? 0;
          return {
            title: `${c.capture.id} - ${c.capture.method} ${c.capture.url}`,
            description: `${date} | Body: ${bodySize} bytes`,
            value: c.capture.id,
          };
        });

        const response = await prompts({
          type: "select",
          name: "captureId",
          message: "Select a captured webhook to replay:",
          choices,
          initial: 0,
        });

        if (!response.captureId) {
          console.log("❌ No webhook selected. Exiting.");
          process.exitCode = 1;
          return;
        }

        selectedCaptureId = response.captureId;
      }

      // Prompt for target URL if not provided
      if (!selectedTargetUrl) {
        const response = await prompts({
          type: "text",
          name: "targetUrl",
          message: "Enter the target URL to replay to:",
          initial: "http://localhost:3000/webhook",
          validate: (value) => {
            try {
              new URL(value);
              return true;
            } catch {
              return "Please enter a valid URL";
            }
          },
        });

        if (!response.targetUrl) {
          console.log("❌ No target URL provided. Exiting.");
          process.exitCode = 1;
          return;
        }

        selectedTargetUrl = response.targetUrl;
      }

      try {
        const result = await replayer.replay(
          selectedCaptureId!,
          selectedTargetUrl!,
          {
            method: options.method,
            headers: options.header,
          }
        );

        console.log("✅ Replay completed successfully!");
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
      } catch (error: any) {
        console.error("❌ Replay failed:", error.message);
        process.exitCode = 1;
      }
    }
  );
