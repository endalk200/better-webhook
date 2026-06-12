import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import {
	UnsupportedVersionFlagCombination,
	UnsupportedVersionFormat,
} from "../../runtime/failures.js";
import type { BuildInfo } from "../../version.js";
import { buildInfo, versionBanner } from "../../version.js";

const formatFlag = Flag.choice("format", ["human", "json"]).pipe(
	Flag.withDefault("human" as const),
	Flag.withDescription("output format: human or json"),
);

const verboseFlag = Flag.boolean("verbose").pipe(
	Flag.withDefault(false),
	Flag.withDescription("print release metadata"),
);

export interface VersionOutput {
	readonly schemaVersion: "1";
	readonly command: "version";
	readonly version: string;
	readonly commit: string;
	readonly date: string;
	readonly builtBy: string;
}

export const versionOutput = (build: BuildInfo): VersionOutput => ({
	schemaVersion: "1",
	command: "version",
	version: build.version,
	commit: build.commit,
	date: build.date,
	builtBy: build.builtBy,
});

export const formatHumanVersion = (build: BuildInfo, verbose: boolean): readonly string[] =>
	verbose
		? [
				versionBanner(build),
				`commit: ${build.commit}`,
				`date: ${build.date}`,
				`built-by: ${build.builtBy}`,
			]
		: [versionBanner(build)];

export const printVersion = (
	build: BuildInfo,
	options: {
		readonly format: "human" | "json" | string;
		readonly verbose: boolean;
	},
): Effect.Effect<void, UnsupportedVersionFlagCombination | UnsupportedVersionFormat> => {
	if (options.format === "json") {
		if (options.verbose) {
			return Effect.fail(
				new UnsupportedVersionFlagCombination({
					message: "unsupported flag combination: --verbose only applies to human format",
				}),
			);
		}

		return Console.log(JSON.stringify(versionOutput(build)));
	}

	if (options.format === "human") {
		return Effect.forEach(formatHumanVersion(build, options.verbose), (line) => Console.log(line), {
			discard: true,
		});
	}

	return Effect.fail(new UnsupportedVersionFormat({ format: options.format }));
};

export const makeVersionCommand = (build: BuildInfo = buildInfo) =>
	Command.make(
		"version",
		{
			format: formatFlag,
			verbose: verboseFlag,
		},
		({ format, verbose }) => printVersion(build, { format, verbose }),
	).pipe(
		Command.withDescription("Print version information"),
		Command.withShortDescription("Print version information"),
	);

export const versionCommand = makeVersionCommand();
