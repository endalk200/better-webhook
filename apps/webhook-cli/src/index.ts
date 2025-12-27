#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";
import {
  templates,
  run,
  capture,
  captures,
  replay,
  dashboard,
} from "./commands/index.js";

// Dynamically read version from package.json to keep it in sync
const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

const program = new Command()
  .name("better-webhook")
  .description(
    "Modern CLI for developing, capturing, and replaying webhooks locally"
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
