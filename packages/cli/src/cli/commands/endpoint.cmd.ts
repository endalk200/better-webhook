import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import type { EndpointProfile } from "../../domain/model.js";
import { CliUsageError } from "../../runtime/failures.js";
import { ProjectStore } from "../../services/project.js";
import {
	formatFlag,
	makeSecretReference,
	optionalValue,
	printOutput,
	projectFlag,
	secretEnvFlag,
	secretFlag,
} from "../shared.js";

const endpointIdArg = Argument.string("endpoint-id");
const idFlag = Flag.string("id").pipe(Flag.withDescription("endpoint id"));
const providerFlag = Flag.choice("provider", ["github", "stripe"] as const).pipe(
	Flag.optional,
	Flag.withDescription("provider-aware endpoint provider"),
);
const targetFlag = Flag.string("target").pipe(Flag.withDescription("local endpoint target URL"));
const optionalTargetFlag = Flag.string("target").pipe(
	Flag.optional,
	Flag.withDescription("local endpoint target URL"),
);
const routeFlag = Flag.string("route").pipe(Flag.withDescription("exact inbound gateway route"));
const optionalRouteFlag = Flag.string("route").pipe(
	Flag.optional,
	Flag.withDescription("exact inbound gateway route"),
);

const endpointSummary = (endpoint: EndpointProfile) => ({
	id: endpoint.id,
	mode: endpoint.mode,
	provider: endpoint.provider ?? null,
	route: endpoint.route,
	targetUrl: endpoint.targetUrl,
	secret: endpoint.secretRef
		? endpoint.secretRef.kind === "env"
			? { kind: "env" as const, name: endpoint.secretRef.name }
			: { kind: "literal" as const, value: "<redacted>" }
		: null,
});

const addCommand = Command.make(
	"add",
	{
		format: formatFlag,
		id: idFlag,
		project: projectFlag,
		provider: providerFlag,
		route: routeFlag,
		secret: secretFlag,
		secretEnv: secretEnvFlag,
		target: targetFlag,
	},
	({ format, id, project, provider, route, secret, secretEnv, target }) =>
		Effect.gen(function* () {
			const projects = yield* ProjectStore;
			const resolved = yield* projects.resolve(optionalValue(project));
			const updated = yield* projects.addEndpoint(resolved, {
				id,
				provider: optionalValue(provider),
				route,
				targetUrl: target,
				secretRef: makeSecretReference({
					secret: optionalValue(secret),
					secretEnv: optionalValue(secretEnv),
				}),
			});
			const endpoint = updated.config.endpoints[id];
			if (!endpoint) {
				return yield* Effect.fail(new CliUsageError({ message: "endpoint was not saved" }));
			}
			return yield* printOutput(
				format,
				"endpoint.add",
				{ projectRoot: updated.root, endpoint: endpointSummary(endpoint) },
				[
					`Added endpoint ${endpoint.id}`,
					`Route: ${endpoint.route}`,
					`Target: ${endpoint.targetUrl}`,
					endpoint.provider ? `Provider: ${endpoint.provider}` : "Provider: generic",
				],
			);
		}),
).pipe(Command.withDescription("Add a named endpoint profile"));

const listCommand = Command.make(
	"list",
	{
		format: formatFlag,
		project: projectFlag,
	},
	({ format, project }) =>
		Effect.gen(function* () {
			const projects = yield* ProjectStore;
			const resolved = yield* projects.resolve(optionalValue(project));
			const endpoints = Object.values(resolved.config.endpoints).map(endpointSummary);
			return yield* printOutput(
				format,
				"endpoint.list",
				{ projectRoot: resolved.root, endpoints },
				endpoints.length === 0
					? ["No endpoints configured"]
					: endpoints.map(
							(endpoint) =>
								`${endpoint.id} ${endpoint.route} -> ${endpoint.targetUrl} (${endpoint.provider ?? "generic"})`,
						),
			);
		}),
).pipe(Command.withDescription("List endpoint profiles"));

const showCommand = Command.make(
	"show",
	{
		format: formatFlag,
		id: endpointIdArg,
		project: projectFlag,
	},
	({ format, id, project }) =>
		Effect.gen(function* () {
			const projects = yield* ProjectStore;
			const resolved = yield* projects.resolve(optionalValue(project));
			const endpoint = resolved.config.endpoints[id];
			if (!endpoint) {
				return yield* Effect.fail(new CliUsageError({ message: `endpoint ${id} was not found` }));
			}
			const summary = endpointSummary(endpoint);
			return yield* printOutput(format, "endpoint.show", { endpoint: summary }, [
				`Endpoint: ${summary.id}`,
				`Mode: ${summary.mode}`,
				`Provider: ${summary.provider ?? "generic"}`,
				`Route: ${summary.route}`,
				`Target: ${summary.targetUrl}`,
			]);
		}),
).pipe(Command.withDescription("Show an endpoint profile"));

const updateCommand = Command.make(
	"update",
	{
		format: formatFlag,
		id: endpointIdArg,
		project: projectFlag,
		route: optionalRouteFlag,
		secret: secretFlag,
		secretEnv: secretEnvFlag,
		target: optionalTargetFlag,
	},
	({ format, id, project, route, secret, secretEnv, target }) =>
		Effect.gen(function* () {
			const projects = yield* ProjectStore;
			const resolved = yield* projects.resolve(optionalValue(project));
			const targetValue = optionalValue(target);
			const routeValue = optionalValue(route);
			const secretValue = optionalValue(secret);
			const secretEnvValue = optionalValue(secretEnv);
			const updated = yield* projects.updateEndpoint(resolved, id, {
				...(targetValue ? { targetUrl: targetValue } : {}),
				...(routeValue ? { route: routeValue } : {}),
				...(secretValue || secretEnvValue
					? { secretRef: makeSecretReference({ secret: secretValue, secretEnv: secretEnvValue }) }
					: {}),
			});
			const endpoint = updated.config.endpoints[id];
			if (!endpoint) {
				return yield* Effect.fail(new CliUsageError({ message: `endpoint ${id} was not found` }));
			}
			return yield* printOutput(
				format,
				"endpoint.update",
				{ projectRoot: updated.root, endpoint: endpointSummary(endpoint) },
				[
					`Updated endpoint ${endpoint.id}`,
					`Route: ${endpoint.route}`,
					`Target: ${endpoint.targetUrl}`,
				],
			);
		}),
).pipe(Command.withDescription("Update an endpoint profile"));

const deleteCommand = Command.make(
	"delete",
	{
		format: formatFlag,
		id: endpointIdArg,
		project: projectFlag,
	},
	({ format, id, project }) =>
		Effect.gen(function* () {
			const projects = yield* ProjectStore;
			const resolved = yield* projects.resolve(optionalValue(project));
			const updated = yield* projects.deleteEndpoint(resolved, id);
			return yield* printOutput(
				format,
				"endpoint.delete",
				{ projectRoot: updated.root, endpointId: id },
				[`Deleted endpoint ${id}`],
			);
		}),
).pipe(Command.withDescription("Delete an endpoint profile"));

export const endpointCommand = Command.make("endpoint").pipe(
	Command.withDescription("Manage endpoint profiles"),
	Command.withSubcommands([addCommand, listCommand, showCommand, updateCommand, deleteCommand]),
);
