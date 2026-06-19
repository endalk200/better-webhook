import { Command } from "effect/unstable/cli";

import { versionCommand } from "./commands/version.cmd.js";

export const makeRootCommand = () =>
	Command.make("bw").pipe(
		Command.withDescription("better-webhook command line interface"),
		Command.withSubcommands([versionCommand]),
	);

export const rootCommand = makeRootCommand();
