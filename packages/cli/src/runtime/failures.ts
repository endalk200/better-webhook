import { Console, Data, Effect, Runtime } from "effect";

class CliFailure extends Data.TaggedError("CliFailure")<{
	readonly message: string;
	readonly exitCode?: number;
}> {}

class ReportedCliFailure extends Data.TaggedError("ReportedCliFailure")<{
	readonly exitCode: number;
}> {
	readonly [Runtime.errorReported] = false;
	readonly [Runtime.errorExitCode] = this.exitCode;
}

const printAndExit = (error: CliFailure) =>
	Console.error(`Error: ${error.message}`).pipe(
		Effect.andThen(Effect.fail(new ReportedCliFailure({ exitCode: error.exitCode ?? 1 }))),
	);

const handleCliFailure = {
	CliFailure: printAndExit,
} as const;

export { CliFailure, handleCliFailure };
