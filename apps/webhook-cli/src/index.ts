#!/usr/bin/env node

import { Command } from "commander";
import { templates, run, capture, captures, replay } from "./commands/index.js";

const program = new Command()
  .name("better-webhook")
  .description(
    "Modern CLI for developing, capturing, and replaying webhooks locally",
  )
  .version("2.0.0");

// Add all commands
program
  .addCommand(templates)
  .addCommand(run)
  .addCommand(capture)
  .addCommand(captures)
  .addCommand(replay);

// Parse and execute
program.parseAsync(process.argv);
