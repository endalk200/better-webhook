import { Command } from "effect/unstable/cli";

import type { BuildInfo } from "../version.js";
import { buildInfo } from "../version.js";
import { endpointCommand } from "./commands/endpoint.cmd.js";
import { initCommand } from "./commands/init.cmd.js";
import { makeVersionCommand } from "./commands/version.cmd.js";

export const makeRootCommand = (build: BuildInfo = buildInfo) =>
	Command.make("bw").pipe(
		Command.withDescription("better-webhook command line interface"),
		Command.withSubcommands([initCommand, endpointCommand, makeVersionCommand(build)]),
	);

export const rootCommand = makeRootCommand();
