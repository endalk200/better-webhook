import { dirname, isAbsolute, join, resolve } from "node:path";

import { Context, Effect, FileSystem, Layer } from "effect";

import { parseJsonc } from "../domain/jsonc.js";
import {
	type EndpointProfile,
	PROJECT_CONFIG_FILE,
	PROJECT_CONFIG_RELATIVE_PATH,
	PROJECT_DIRECTORY,
	type ProjectConfig,
	type ResolvedProject,
	type SecretReference,
} from "../domain/model.js";
import {
	isSafeTargetUrl,
	makeEndpointProfile,
	makeProjectConfig,
	normalizeRoute,
	validateProjectConfig,
} from "../domain/validation.js";
import {
	CliUsageError,
	EndpointAlreadyExists,
	EndpointNotFound,
	InvalidProjectConfig,
	ProjectAlreadyExists,
	ProjectNotFound,
	RouteAlreadyExists,
	UnsafeTargetUrl,
} from "../runtime/failures.js";

export interface ProjectStoreApi {
	readonly init: (options: {
		readonly directory?: string;
		readonly name?: string;
		readonly force?: boolean;
	}) => Effect.Effect<ResolvedProject, unknown, FileSystem.FileSystem>;
	readonly resolve: (
		project?: string,
	) => Effect.Effect<ResolvedProject, unknown, FileSystem.FileSystem>;
	readonly write: (
		project: ResolvedProject,
		config: ProjectConfig,
	) => Effect.Effect<ResolvedProject, unknown, FileSystem.FileSystem>;
	readonly addEndpoint: (
		project: ResolvedProject,
		options: {
			readonly id: string;
			readonly provider?: string;
			readonly targetUrl: string;
			readonly route: string;
			readonly secretRef?: SecretReference;
		},
	) => Effect.Effect<ResolvedProject, unknown, FileSystem.FileSystem>;
	readonly updateEndpoint: (
		project: ResolvedProject,
		id: string,
		patch: {
			readonly targetUrl?: string;
			readonly route?: string;
			readonly secretRef?: SecretReference;
		},
	) => Effect.Effect<ResolvedProject, unknown, FileSystem.FileSystem>;
	readonly deleteEndpoint: (
		project: ResolvedProject,
		id: string,
	) => Effect.Effect<ResolvedProject, unknown, FileSystem.FileSystem>;
}

export class ProjectStore extends Context.Service<ProjectStore, ProjectStoreApi>()(
	"better-webhook/ProjectStore",
) {}

export const ProjectStoreLive = Layer.succeed(ProjectStore, {
	init: (options) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const root = resolve(options.directory ?? (yield* Effect.sync(() => process.cwd())));
			const configPath = join(root, PROJECT_CONFIG_RELATIVE_PATH);
			const exists = yield* fs.exists(configPath);
			if (exists && !options.force) {
				return yield* Effect.fail(new ProjectAlreadyExists({ path: configPath }));
			}

			const config = makeProjectConfig({
				name: options.name ?? projectNameFromPath(root),
			});
			const valid = validateProjectConfig(config);
			if (!valid.ok) {
				return yield* Effect.fail(
					new InvalidProjectConfig({ path: configPath, issues: valid.issues }),
				);
			}

			yield* fs.makeDirectory(join(root, PROJECT_DIRECTORY), { recursive: true });
			yield* fs.writeFileString(configPath, `${JSON.stringify(valid.value, null, 2)}\n`);
			return { root, configPath, config: valid.value };
		}),
	resolve: (project) =>
		Effect.gen(function* () {
			const configPath = project
				? yield* explicitConfigPath(project)
				: yield* findNearestConfigPath(yield* Effect.sync(() => process.cwd()));
			const root = dirname(dirname(configPath));
			const config = yield* readConfig(configPath);
			return { root, configPath, config };
		}),
	write: writeProject,
	addEndpoint: (project, options) =>
		Effect.gen(function* () {
			if (project.config.endpoints[options.id]) {
				return yield* Effect.fail(new EndpointAlreadyExists({ id: options.id }));
			}
			const mode = options.provider ? "provider" : "generic";
			const provider = options.provider;
			if (provider && provider !== "github" && provider !== "stripe") {
				return yield* Effect.fail(
					new CliUsageError({
						message: `unsupported provider ${JSON.stringify(provider)}: expected github or stripe`,
					}),
				);
			}
			const providerId = provider === "github" || provider === "stripe" ? provider : undefined;
			const endpoint = makeEndpointProfile({
				id: options.id,
				mode,
				...(providerId ? { provider: providerId } : {}),
				targetUrl: options.targetUrl,
				route: options.route,
				secretRef: options.secretRef,
			});
			if (!endpoint.ok) {
				const unsafeIssues = isSafeTargetUrl(options.targetUrl);
				if (!unsafeIssues.ok) {
					return yield* Effect.fail(
						new UnsafeTargetUrl({ targetUrl: options.targetUrl, issues: unsafeIssues.issues }),
					);
				}
				return yield* Effect.fail(new CliUsageError({ message: endpoint.issues.join("; ") }));
			}
			if (
				Object.values(project.config.endpoints).some((item) => item.route === endpoint.value.route)
			) {
				return yield* Effect.fail(new RouteAlreadyExists({ route: endpoint.value.route }));
			}
			return yield* writeProject(project, {
				...project.config,
				endpoints: {
					...project.config.endpoints,
					[endpoint.value.id]: endpoint.value,
				},
			});
		}),
	updateEndpoint: (project, id, patch) =>
		Effect.gen(function* () {
			const current = project.config.endpoints[id];
			if (!current) {
				return yield* Effect.fail(new EndpointNotFound({ id }));
			}
			const route = patch.route
				? normalizeRoute(patch.route)
				: { ok: true as const, value: current.route };
			if (!route.ok) {
				return yield* Effect.fail(new CliUsageError({ message: route.issues.join("; ") }));
			}
			const targetUrl = patch.targetUrl ?? current.targetUrl;
			const target = isSafeTargetUrl(targetUrl);
			if (!target.ok) {
				return yield* Effect.fail(new UnsafeTargetUrl({ targetUrl, issues: target.issues }));
			}
			if (
				Object.values(project.config.endpoints).some(
					(endpoint) => endpoint.id !== id && endpoint.route === route.value,
				)
			) {
				return yield* Effect.fail(new RouteAlreadyExists({ route: route.value }));
			}
			const updated: EndpointProfile = {
				...current,
				targetUrl: target.value.toString(),
				route: route.value,
				...(patch.secretRef ? { secretRef: patch.secretRef } : {}),
				updatedAt: new Date().toISOString(),
			};
			return yield* writeProject(project, {
				...project.config,
				endpoints: {
					...project.config.endpoints,
					[id]: updated,
				},
			});
		}),
	deleteEndpoint: (project, id) =>
		Effect.gen(function* () {
			if (!project.config.endpoints[id]) {
				return yield* Effect.fail(new EndpointNotFound({ id }));
			}
			const { [id]: _removed, ...endpoints } = project.config.endpoints;
			return yield* writeProject(project, {
				...project.config,
				endpoints,
			});
		}),
});

function writeProject(project: ResolvedProject, config: ProjectConfig) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const valid = validateProjectConfig(config);
		if (!valid.ok) {
			return yield* Effect.fail(
				new InvalidProjectConfig({ path: project.configPath, issues: valid.issues }),
			);
		}
		yield* fs.writeFileString(project.configPath, `${JSON.stringify(valid.value, null, 2)}\n`);
		return { ...project, config: valid.value };
	});
}

const explicitConfigPath = (project: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const resolved = resolve(project);
		const configPath = project.endsWith(PROJECT_CONFIG_FILE)
			? resolved
			: join(resolved, PROJECT_CONFIG_RELATIVE_PATH);
		const exists = yield* fs.exists(configPath);
		if (!exists) {
			return yield* Effect.fail(new ProjectNotFound({ start: resolved }));
		}
		return configPath;
	});

const findNearestConfigPath = (start: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		let cursor = resolve(start);
		while (true) {
			const configPath = join(cursor, PROJECT_CONFIG_RELATIVE_PATH);
			if (yield* fs.exists(configPath)) {
				return configPath;
			}
			const parent = dirname(cursor);
			if (parent === cursor) {
				return yield* Effect.fail(new ProjectNotFound({ start }));
			}
			cursor = parent;
		}
	});

const readConfig = (path: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const text = yield* fs.readFileString(path);
		const parsed = yield* Effect.try({
			try: () => parseJsonc(text),
			catch: (error) =>
				new InvalidProjectConfig({
					path,
					issues: [
						`could not parse JSONC: ${error instanceof Error ? error.message : String(error)}`,
					],
				}),
		});
		const valid = validateProjectConfig(parsed);
		if (!valid.ok) {
			return yield* Effect.fail(new InvalidProjectConfig({ path, issues: valid.issues }));
		}
		return valid.value;
	});

const projectNameFromPath = (path: string) => {
	const normalized = isAbsolute(path) ? path : resolve(path);
	const name = normalized.split(/[\\/]/u).filter(Boolean).at(-1);
	return name && name.length > 0 ? name : "better-webhook-project";
};
