import { Console, Data, Effect, Runtime } from "effect";

export class UnsupportedVersionFormat extends Data.TaggedError("UnsupportedVersionFormat")<{
	readonly format: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class UnsupportedVersionFlagCombination extends Data.TaggedError(
	"UnsupportedVersionFlagCombination",
)<{
	readonly message: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class CliUsageError extends Data.TaggedError("CliUsageError")<{
	readonly message: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class ProjectAlreadyExists extends Data.TaggedError("ProjectAlreadyExists")<{
	readonly path: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class ProjectNotFound extends Data.TaggedError("ProjectNotFound")<{
	readonly start: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class InvalidProjectConfig extends Data.TaggedError("InvalidProjectConfig")<{
	readonly path: string;
	readonly issues: readonly string[];
}> {
	readonly [Runtime.errorReported] = false;
}

export class EndpointAlreadyExists extends Data.TaggedError("EndpointAlreadyExists")<{
	readonly id: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class EndpointNotFound extends Data.TaggedError("EndpointNotFound")<{
	readonly id: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class RouteAlreadyExists extends Data.TaggedError("RouteAlreadyExists")<{
	readonly route: string;
}> {
	readonly [Runtime.errorReported] = false;
}

export class UnsafeTargetUrl extends Data.TaggedError("UnsafeTargetUrl")<{
	readonly targetUrl: string;
	readonly issues: readonly string[];
}> {
	readonly [Runtime.errorReported] = false;
}

const printAndFail = <E>(error: E, message: string) =>
	Console.error(`Error: ${message}`).pipe(Effect.andThen(Effect.fail(error)));

export const handleCliFailure = {
	CliUsageError: (error: CliUsageError) => printAndFail(error, error.message),
	EndpointAlreadyExists: (error: EndpointAlreadyExists) =>
		printAndFail(error, `endpoint ${JSON.stringify(error.id)} already exists`),
	EndpointNotFound: (error: EndpointNotFound) =>
		printAndFail(error, `endpoint ${JSON.stringify(error.id)} was not found`),
	InvalidProjectConfig: (error: InvalidProjectConfig) =>
		printAndFail(error, `invalid project config at ${error.path}: ${error.issues.join("; ")}`),
	ProjectAlreadyExists: (error: ProjectAlreadyExists) =>
		printAndFail(error, `project config already exists at ${error.path}`),
	ProjectNotFound: (error: ProjectNotFound) =>
		printAndFail(
			error,
			`no better-webhook project found from ${error.start}; run "bw init" first or pass --project`,
		),
	RouteAlreadyExists: (error: RouteAlreadyExists) =>
		printAndFail(error, `inbound route ${JSON.stringify(error.route)} is already used`),
	UnsafeTargetUrl: (error: UnsafeTargetUrl) =>
		printAndFail(
			error,
			`unsafe target URL ${JSON.stringify(error.targetUrl)}: ${error.issues.join("; ")}`,
		),
	UnsupportedVersionFlagCombination: (error: UnsupportedVersionFlagCombination) =>
		printAndFail(error, error.message),
	UnsupportedVersionFormat: (error: UnsupportedVersionFormat) =>
		printAndFail(
			error,
			`unsupported output format ${JSON.stringify(error.format)}: expected human or json`,
		),
} as const;
