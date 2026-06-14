import { Console, Effect, Option } from "effect";
import { Flag } from "effect/unstable/cli";
import type { SecretReference } from "../domain/model.js";
import {
	type CommandEnvelope,
	MACHINE_SCHEMA_VERSION,
	type OutputFormat,
} from "../domain/model.js";

export const formatFlag = Flag.choice("format", ["human", "json"] as const).pipe(
	Flag.withDefault("human" as const),
	Flag.withDescription("output format: human or json"),
);

export const projectFlag = Flag.string("project").pipe(
	Flag.optional,
	Flag.withDescription("project directory or .better-webhook/project.json path"),
);

export const secretEnvFlag = Flag.string("secret-env").pipe(
	Flag.optional,
	Flag.withDescription("environment variable containing the provider secret"),
);

export const secretFlag = Flag.string("secret").pipe(
	Flag.optional,
	Flag.withDescription("provider secret value; prefer --secret-env for saved profiles"),
);

export const printLines = (lines: readonly string[]) =>
	Effect.forEach(lines, (line) => Console.log(line), { discard: true });

export const printOutput = <TCommand extends string, TData>(
	format: OutputFormat,
	command: TCommand,
	data: TData,
	human: readonly string[],
) => {
	if (format === "json") {
		const envelope: CommandEnvelope<TCommand, TData> = {
			schemaVersion: MACHINE_SCHEMA_VERSION,
			command,
			data,
		};
		return Console.log(JSON.stringify(envelope));
	}
	return printLines(human);
};

export const makeSecretReference = (options: {
	readonly secretEnv?: string;
	readonly secret?: string;
}): SecretReference | undefined => {
	if (options.secretEnv) {
		return { kind: "env", name: options.secretEnv };
	}
	if (options.secret) {
		return { kind: "literal", value: options.secret };
	}
	return undefined;
};

export const optionalValue = <A>(value: Option.Option<A>): A | undefined =>
	Option.getOrUndefined(value);
