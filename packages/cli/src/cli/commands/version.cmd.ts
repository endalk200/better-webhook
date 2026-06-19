import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CliFailure } from "../../runtime/failures.js";
import { buildInfo, versionBanner } from "../../version.js";

export const versionCommand = Command.make("version", {
	format: Flag.choice("format", ["human", "json"]).pipe(
		Flag.withDefault("human" as const),
		Flag.withDescription("output format: human or json"),
	),

	verbose: Flag.boolean("verbose").pipe(
		Flag.withDefault(false),
		Flag.withDescription("print release metadata"),
	),
}).pipe(
	Command.withDescription("Print version information"),
	Command.withShortDescription("Print version information"),
	Command.withHandler((input) =>
		Effect.gen(function* () {
			if (input.format === "json") {
				if (input.verbose) {
					return yield* Effect.fail(
						new CliFailure({
							message: "unsupported flag combination: --verbose only applies to human format",
							exitCode: 1,
						}),
					);
				}

				return yield* Console.log(
					JSON.stringify({
						schemaVersion: "1",
						command: "version",
						version: buildInfo.version,
						commit: buildInfo.commit,
						date: buildInfo.date,
						builtBy: buildInfo.builtBy,
					}),
				);
			}

			if (input.verbose) {
				return yield* Effect.forEach(
					[
						versionBanner(buildInfo),
						`commit: ${buildInfo.commit}`,
						`date: ${buildInfo.date}`,
						`built-by: ${buildInfo.builtBy}`,
					],
					(line) => Console.log(line),
					{
						discard: true,
					},
				);
			}

			return yield* Console.log(versionBanner(buildInfo));
		}),
	),
);
