import { Command } from "commander";
import { WebhookReplayer } from "../replay.js";
import { findCapturesDir } from "../utils/index.js";

export const replay = new Command()
  .name("replay")
  .argument("<captureId>", "ID of the captured webhook to replay")
  .argument("<targetUrl>", "Target URL to replay the webhook to")
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
    [] as Array<{ key: string; value: string }>,
  )
  .action(
    async (
      captureId: string,
      targetUrl: string,
      options: {
        method?: string;
        header?: Array<{ key: string; value: string }>;
      },
    ) => {
      const cwd = process.cwd();
      const capturesDir = findCapturesDir(cwd);
      const replayer = new WebhookReplayer(capturesDir);

      try {
        const result = await replayer.replay(captureId, targetUrl, {
          method: options.method,
          headers: options.header,
        });

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
    },
  );
