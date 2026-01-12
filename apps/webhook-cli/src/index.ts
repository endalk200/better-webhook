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

// Dynamically read version from package.json to keep it in sync
const packageJsonPath = fileURLToPath(
  new URL("../package.json", import.meta.url),
);
const packageJson = JSON.parse(
  readFileSync(packageJsonPath, { encoding: "utf8" }),
);

const program = new Command()
  .name("better-webhook")
  .description(
    "Modern CLI for developing, capturing, and replaying webhooks locally",
  )
  .version(packageJson.version);

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
