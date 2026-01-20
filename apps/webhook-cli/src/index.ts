#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
  try {
    const packageJsonPath = fileURLToPath(
      new URL("../package.json", import.meta.url),
    );
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, { encoding: "utf8" }),
    );
    return packageJson.version;
  } catch {
    return "0.0.0-unknown";
  }
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
