import { Effect, Stdio } from "effect";
import { CliConfig, Command, GlobalFlag } from "effect/unstable/cli";

import { buildInfo } from "../version.js";
import { rootCommand } from "./root.js";

export const cliConfigLayer = CliConfig.layer({
	builtIns: [GlobalFlag.Help, GlobalFlag.Version, GlobalFlag.Completions, GlobalFlag.LogLevel],
});

export const normalizeCliArgs = (args: readonly string[]) => {
	if (args.length === 0) {
		return ["--help"];
	}

	if (args.length === 1 && args[0] === "--version") {
		return ["version"];
	}

	return args;
};

export const runCliWithArgs = (args: readonly string[]) =>
	Command.runWith(rootCommand, {
		version: buildInfo.version,
	})(normalizeCliArgs(args)).pipe(Effect.provide(cliConfigLayer));

export const runCli = Stdio.Stdio.use(({ args }) => Effect.flatMap(args, runCliWithArgs));
