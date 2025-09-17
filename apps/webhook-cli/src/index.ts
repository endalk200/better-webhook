import { Command } from "commander";

import { webhooks } from "./commands/webhooks.js";
import { capture } from "./commands/capture.js";
import { replay } from "./commands/replay.js";

const program = new Command()
  .name("better-webhook")
  .description("CLI for listing, downloading and executing predefined webhooks")
  .version("0.2.0");

program
  .addCommand(webhooks)
  .addCommand(capture)
  .addCommand(replay);

program.parseAsync(process.argv);
