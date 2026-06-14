import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { ProjectStore } from "../../services/project.js";
import { formatFlag, optionalValue, printOutput, projectFlag } from "../shared.js";

const nameFlag = Flag.string("name").pipe(Flag.optional, Flag.withDescription("project name"));

const forceFlag = Flag.boolean("force").pipe(
	Flag.withDefault(false),
	Flag.withDescription("overwrite an existing project config"),
);

export const initCommand = Command.make(
	"init",
	{
		format: formatFlag,
		force: forceFlag,
		name: nameFlag,
		project: projectFlag,
	},
	({ format, force, name, project }) =>
		Effect.gen(function* () {
			const projects = yield* ProjectStore;
			const resolved = yield* projects.init({
				directory: optionalValue(project),
				force,
				name: optionalValue(name),
			});
			return yield* printOutput(
				format,
				"init",
				{
					projectRoot: resolved.root,
					configPath: resolved.configPath,
					name: resolved.config.name,
				},
				[
					`Initialized better-webhook project ${resolved.config.name}`,
					`Config: ${resolved.configPath}`,
				],
			);
		}),
).pipe(
	Command.withDescription("Initialize a directory-local better-webhook project"),
	Command.withShortDescription("Initialize a project"),
);
