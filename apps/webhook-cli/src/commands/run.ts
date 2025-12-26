import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";
import chalk from "chalk";
import { getTemplateManager } from "../core/template-manager.js";
import { executeTemplate } from "../core/executor.js";
import type { HeaderEntry, WebhookProvider } from "../types/index.js";

/**
 * Get the environment variable name for a provider's secret
 */
function getSecretEnvVarName(provider: WebhookProvider): string {
  const envVarMap: Record<WebhookProvider, string> = {
    github: "GITHUB_WEBHOOK_SECRET",
    stripe: "STRIPE_WEBHOOK_SECRET",
    shopify: "SHOPIFY_WEBHOOK_SECRET",
    twilio: "TWILIO_WEBHOOK_SECRET",
    ragie: "RAGIE_WEBHOOK_SECRET",
    slack: "SLACK_WEBHOOK_SECRET",
    linear: "LINEAR_WEBHOOK_SECRET",
    clerk: "CLERK_WEBHOOK_SECRET",
    sendgrid: "SENDGRID_WEBHOOK_SECRET",
    discord: "DISCORD_WEBHOOK_SECRET",
    custom: "WEBHOOK_SECRET",
  };
  return envVarMap[provider] || "WEBHOOK_SECRET";
}

export const run = new Command()
  .name("run")
  .argument("[templateId]", "Template ID to run")
  .description("Run a webhook template against a target URL")
  .requiredOption("-u, --url <url>", "Target URL to send the webhook to")
  .option("-s, --secret <secret>", "Secret for signature generation")
  .option(
    "-H, --header <header>",
    "Add custom header (format: key:value)",
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
    [] as HeaderEntry[]
  )
  .option("-v, --verbose", "Show detailed request/response information")
  .action(
    async (
      templateId?: string,
      options?: {
        url: string;
        secret?: string;
        header?: HeaderEntry[];
        verbose?: boolean;
      }
    ) => {
      const manager = getTemplateManager();

      // Interactive selection if no templateId provided
      if (!templateId) {
        const spinner = ora("Loading templates...").start();

        try {
          const local = manager.listLocalTemplates();
          const remote = await manager.listRemoteTemplates();
          spinner.stop();

          if (local.length === 0 && remote.length === 0) {
            console.log(chalk.yellow("\n📭 No templates available."));
            console.log(
              chalk.gray(
                "   Download templates with: better-webhook templates download\n"
              )
            );
            return;
          }

          const choices: Array<{
            title: string;
            description: string;
            value: string;
          }> = [];

          // Add local templates first
          if (local.length > 0) {
            for (const t of local) {
              choices.push({
                title: `${t.id} ${chalk.green("(local)")}`,
                description: `${t.metadata.provider} - ${t.metadata.event}`,
                value: t.id,
              });
            }
          }

          // Add remote templates that aren't downloaded
          const remoteOnly = remote.filter((t) => !t.isDownloaded);
          for (const t of remoteOnly) {
            choices.push({
              title: `${t.metadata.id} ${chalk.gray("(remote)")}`,
              description: `${t.metadata.provider} - ${t.metadata.event}`,
              value: `remote:${t.metadata.id}`,
            });
          }

          const response = await prompts({
            type: "select",
            name: "templateId",
            message: "Select a template to run:",
            choices,
          });

          if (!response.templateId) {
            console.log(chalk.yellow("Cancelled"));
            return;
          }

          templateId = response.templateId;
        } catch (error: any) {
          spinner.fail("Failed to load templates");
          console.error(chalk.red(error.message));
          process.exitCode = 1;
          return;
        }
      }

      // Check if it's a remote template that needs downloading
      if (templateId?.startsWith("remote:")) {
        const remoteId = templateId.replace("remote:", "");
        const downloadSpinner = ora(`Downloading ${remoteId}...`).start();
        try {
          await manager.downloadTemplate(remoteId);
          downloadSpinner.succeed(`Downloaded ${remoteId}`);
          templateId = remoteId;
        } catch (error: any) {
          downloadSpinner.fail(`Failed to download: ${error.message}`);
          process.exitCode = 1;
          return;
        }
      }

      // Get the template
      const localTemplate = manager.getLocalTemplate(templateId!);
      if (!localTemplate) {
        console.log(chalk.red(`\n❌ Template not found: ${templateId}`));
        console.log(
          chalk.gray(
            "   Download it with: better-webhook templates download " +
              templateId +
              "\n"
          )
        );
        process.exitCode = 1;
        return;
      }

      // Get target URL (required via CLI flag)
      const targetUrl = options!.url;

      // Resolve secret: CLI option → environment variable → undefined
      let secret = options?.secret;
      if (!secret && localTemplate.metadata.provider) {
        // Try to get secret from environment variable
        const envVarName = getSecretEnvVarName(localTemplate.metadata.provider);
        secret = process.env[envVarName];
      }

      // Show info
      console.log(chalk.bold("\n🚀 Executing Webhook\n"));
      console.log(chalk.gray(`   Template: ${templateId}`));
      console.log(
        chalk.gray(`   Provider: ${localTemplate.metadata.provider}`)
      );
      console.log(chalk.gray(`   Event: ${localTemplate.metadata.event}`));
      console.log(chalk.gray(`   Target: ${targetUrl}`));
      if (secret) {
        console.log(chalk.gray(`   Signature: Will be generated`));
      } else {
        console.log(
          chalk.yellow(
            `   ⚠️  No secret provided - signature will not be generated`
          )
        );
      }
      console.log();

      // Execute
      const spinner = ora("Sending webhook...").start();

      try {
        const result = await executeTemplate(localTemplate.template, {
          url: targetUrl,
          secret,
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
          `   Status: ${statusColor(`${result.status} ${result.statusText}`)}`
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
                .join("\n")
            )
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
          console.log(chalk.green("✓ Webhook delivered successfully\n"));
        } else {
          console.log(
            chalk.yellow(`⚠ Webhook delivered with status ${result.status}\n`)
          );
        }
      } catch (error: any) {
        spinner.fail("Request failed");
        console.error(chalk.red(`\n❌ ${error.message}\n`));
        process.exitCode = 1;
      }
    }
  );
