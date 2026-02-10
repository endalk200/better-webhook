import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveRuntimeDir } from "./core/runtime-paths.js";
import {
  templates,
  run,
  capture,
  captures,
  replay,
  dashboard,
} from "./commands/index.js";

// Build-time version injection for standalone binaries (set via --define CLI_VERSION)
declare const CLI_VERSION: string | undefined;

function getVersion(): string {
  // Use build-time injected version if available (standalone binary)
  if (typeof CLI_VERSION !== "undefined") {
    return CLI_VERSION;
  }

  // Fall back to reading from package.json (npm install / dev mode)
  const runtimeDir = resolveRuntimeDir();
  const candidatePaths = [
    path.resolve(runtimeDir, "..", "package.json"),
    path.resolve(runtimeDir, "package.json"),
    path.resolve(process.cwd(), "package.json"),
  ];

  for (const packageJsonPath of candidatePaths) {
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, { encoding: "utf8" }),
      ) as { version?: string };

      if (typeof packageJson.version === "string" && packageJson.version) {
        return packageJson.version;
      }
    } catch {
      continue;
    }
  }

  return "0.0.0-unknown";
}

const program = new Command()
  .name("better-webhook")
  .description(
    "Modern CLI for developing, capturing, and replaying webhooks locally",
  )
  .version(getVersion());

// Add all commands
program
  .addCommand(templates)
  .addCommand(run)
  .addCommand(capture)
  .addCommand(captures)
  .addCommand(replay)
  .addCommand(dashboard);

// Parse and execute
program.parseAsync(process.argv);
