import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";
import chalk from "chalk";
import { getTemplateManager } from "../core/template-manager.js";

/**
 * List remote templates
 */
const listCommand = new Command()
  .name("list")
  .alias("ls")
  .description("List available remote templates from the repository")
  .option(
    "-p, --provider <provider>",
    "Filter by provider (stripe, github, etc.)",
  )
  .option("-r, --refresh", "Force refresh the template index cache")
  .action(async (options: { provider?: string; refresh?: boolean }) => {
    const spinner = ora("Fetching remote templates...").start();

    try {
      const manager = getTemplateManager();
      const templates = await manager.listRemoteTemplates();
      spinner.stop();

      if (templates.length === 0) {
        console.log(chalk.yellow("📭 No remote templates found."));
        return;
      }

      // Filter by provider if specified
      let filtered = templates;
      if (options.provider) {
        filtered = templates.filter(
          (t) =>
            t.metadata.provider.toLowerCase() ===
            options.provider?.toLowerCase(),
        );
      }

      if (filtered.length === 0) {
        console.log(
          chalk.yellow(
            `📭 No templates found for provider: ${options.provider}`,
          ),
        );
        return;
      }

      console.log(chalk.bold("\n📦 Available Templates\n"));

      // Group by provider
      const byProvider = new Map<string, typeof filtered>();
      for (const t of filtered) {
        const provider = t.metadata.provider;
        if (!byProvider.has(provider)) {
          byProvider.set(provider, []);
        }
        byProvider.get(provider)!.push(t);
      }

      for (const [provider, providerTemplates] of byProvider) {
        console.log(chalk.cyan.bold(`  ${provider.toUpperCase()}`));

        for (const t of providerTemplates) {
          const status = t.isDownloaded
            ? chalk.green("✓ downloaded")
            : chalk.gray("○ remote");
          console.log(`    ${chalk.white(t.metadata.id)} ${status}`);
          if (t.metadata.description) {
            console.log(chalk.gray(`      ${t.metadata.description}`));
          }
        }
        console.log();
      }

      console.log(chalk.gray(`  Total: ${filtered.length} templates`));
      console.log(
        chalk.gray(`  Download: better-webhook templates download <id>\n`),
      );
    } catch (error: any) {
      spinner.fail("Failed to fetch templates");
      console.error(chalk.red(error.message));
      process.exitCode = 1;
    }
  });

/**
 * Download a template
 */
const downloadCommand = new Command()
  .name("download")
  .alias("get")
  .argument("[templateId]", "Template ID to download")
  .description("Download a template to local storage")
  .option("-a, --all", "Download all available templates")
  .action(async (templateId?: string, options?: { all?: boolean }) => {
    const manager = getTemplateManager();

    if (options?.all) {
      const spinner = ora("Fetching template list...").start();
      try {
        const templates = await manager.listRemoteTemplates();
        const toDownload = templates.filter((t) => !t.isDownloaded);
        spinner.stop();

        if (toDownload.length === 0) {
          console.log(chalk.green("✓ All templates already downloaded"));
          return;
        }

        console.log(
          chalk.bold(`\nDownloading ${toDownload.length} templates...\n`),
        );

        for (const t of toDownload) {
          const downloadSpinner = ora(
            `Downloading ${t.metadata.id}...`,
          ).start();
          try {
            await manager.downloadTemplate(t.metadata.id);
            downloadSpinner.succeed(`Downloaded ${t.metadata.id}`);
          } catch (error: any) {
            downloadSpinner.fail(`Failed: ${t.metadata.id} - ${error.message}`);
          }
        }

        console.log(chalk.green("\n✓ Download complete\n"));
      } catch (error: any) {
        spinner.fail("Failed to fetch templates");
        console.error(chalk.red(error.message));
        process.exitCode = 1;
      }
      return;
    }

    // Interactive selection if no templateId provided
    if (!templateId) {
      const spinner = ora("Fetching templates...").start();
      try {
        const templates = await manager.listRemoteTemplates();
        spinner.stop();

        const notDownloaded = templates.filter((t) => !t.isDownloaded);
        if (notDownloaded.length === 0) {
          console.log(chalk.green("✓ All templates already downloaded"));
          return;
        }

        const choices = notDownloaded.map((t) => ({
          title: t.metadata.id,
          description: `${t.metadata.provider} - ${t.metadata.event}`,
          value: t.metadata.id,
        }));

        const response = await prompts({
          type: "select",
          name: "templateId",
          message: "Select a template to download:",
          choices,
        });

        if (!response.templateId) {
          console.log(chalk.yellow("Cancelled"));
          return;
        }

        templateId = response.templateId;
      } catch (error: any) {
        spinner.fail("Failed to fetch templates");
        console.error(chalk.red(error.message));
        process.exitCode = 1;
        return;
      }
    }

    // Download the template
    const spinner = ora(`Downloading ${templateId}...`).start();
    try {
      const template = await manager.downloadTemplate(templateId!);
      spinner.succeed(`Downloaded ${templateId}`);
      console.log(chalk.gray(`  Saved to: ${template.filePath}`));
      console.log(chalk.gray(`  Run with: better-webhook run ${templateId}\n`));
    } catch (error: any) {
      spinner.fail(`Failed to download ${templateId}`);
      console.error(chalk.red(error.message));
      process.exitCode = 1;
    }
  });

/**
 * List local/downloaded templates
 */
const localCommand = new Command()
  .name("local")
  .description("List downloaded local templates")
  .option("-p, --provider <provider>", "Filter by provider")
  .action((options: { provider?: string }) => {
    const manager = getTemplateManager();
    let templates = manager.listLocalTemplates();

    if (options.provider) {
      templates = templates.filter(
        (t) =>
          t.metadata.provider.toLowerCase() === options.provider?.toLowerCase(),
      );
    }

    if (templates.length === 0) {
      console.log(chalk.yellow("\n📭 No local templates found."));
      console.log(
        chalk.gray(
          "   Download templates with: better-webhook templates download\n",
        ),
      );
      return;
    }

    console.log(chalk.bold("\n📁 Local Templates\n"));

    // Group by provider
    const byProvider = new Map<string, typeof templates>();
    for (const t of templates) {
      const provider = t.metadata.provider;
      if (!byProvider.has(provider)) {
        byProvider.set(provider, []);
      }
      byProvider.get(provider)!.push(t);
    }

    for (const [provider, providerTemplates] of byProvider) {
      console.log(chalk.cyan.bold(`  ${provider.toUpperCase()}`));

      for (const t of providerTemplates) {
        console.log(`    ${chalk.white(t.id)}`);
        console.log(chalk.gray(`      Event: ${t.metadata.event}`));
        console.log(
          chalk.gray(
            `      Downloaded: ${new Date(t.downloadedAt).toLocaleDateString()}`,
          ),
        );
      }
      console.log();
    }

    console.log(chalk.gray(`  Total: ${templates.length} templates`));
    console.log(chalk.gray(`  Storage: ${manager.getTemplatesDir()}\n`));
  });

/**
 * Search templates
 */
const searchCommand = new Command()
  .name("search")
  .argument("<query>", "Search query")
  .description("Search templates by name, provider, or event")
  .action(async (query: string) => {
    const spinner = ora("Searching...").start();

    try {
      const manager = getTemplateManager();
      const results = await manager.searchTemplates(query);
      spinner.stop();

      const totalCount = results.remote.length + results.local.length;

      if (totalCount === 0) {
        console.log(chalk.yellow(`\n📭 No templates found for: "${query}"\n`));
        return;
      }

      console.log(chalk.bold(`\n🔍 Search Results for "${query}"\n`));

      if (results.local.length > 0) {
        console.log(chalk.cyan.bold("  LOCAL TEMPLATES"));
        for (const t of results.local) {
          console.log(
            `    ${chalk.green("✓")} ${t.id} (${t.metadata.provider})`,
          );
        }
        console.log();
      }

      if (results.remote.length > 0) {
        console.log(chalk.cyan.bold("  REMOTE TEMPLATES"));
        for (const t of results.remote) {
          const status = t.isDownloaded ? chalk.green("✓") : chalk.gray("○");
          console.log(
            `    ${status} ${t.metadata.id} (${t.metadata.provider})`,
          );
        }
        console.log();
      }

      console.log(chalk.gray(`  Found: ${totalCount} templates\n`));
    } catch (error: any) {
      spinner.fail("Search failed");
      console.error(chalk.red(error.message));
      process.exitCode = 1;
    }
  });

/**
 * Clear template cache
 */
const cacheCommand = new Command()
  .name("cache")
  .description("Manage template cache")
  .option("-c, --clear", "Clear the template cache")
  .action((options: { clear?: boolean }) => {
    if (options.clear) {
      const manager = getTemplateManager();
      manager.clearCache();
      console.log(chalk.green("✓ Template cache cleared"));
    } else {
      console.log("Use --clear to clear the template cache");
    }
  });

/**
 * Clean/remove all downloaded templates
 */
const cleanCommand = new Command()
  .name("clean")
  .alias("remove-all")
  .description("Remove all downloaded templates")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (options: { force?: boolean }) => {
    const manager = getTemplateManager();
    const templates = manager.listLocalTemplates();

    if (templates.length === 0) {
      console.log(chalk.yellow("\n📭 No local templates to remove.\n"));
      return;
    }

    console.log(
      chalk.bold(`\n🗑️  Found ${templates.length} downloaded template(s)\n`),
    );

    // Show what will be deleted
    for (const t of templates) {
      console.log(chalk.gray(`    ${t.id} (${t.metadata.provider})`));
    }
    console.log();

    if (!options.force) {
      const response = await prompts({
        type: "confirm",
        name: "confirm",
        message: `Delete all ${templates.length} template(s)?`,
        initial: false,
      });

      if (!response.confirm) {
        console.log(chalk.yellow("Cancelled"));
        return;
      }
    }

    const deleted = manager.deleteAllLocalTemplates();
    console.log(chalk.green(`\n✓ Removed ${deleted} template(s)`));
    console.log(chalk.gray(`  Storage: ${manager.getTemplatesDir()}\n`));
  });

/**
 * Main templates command
 */
export const templates = new Command()
  .name("templates")
  .alias("t")
  .description("Manage webhook templates")
  .addCommand(listCommand)
  .addCommand(downloadCommand)
  .addCommand(localCommand)
  .addCommand(searchCommand)
  .addCommand(cacheCommand)
  .addCommand(cleanCommand);
