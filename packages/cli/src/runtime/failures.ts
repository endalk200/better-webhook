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

const printAndFail = <E>(error: E, message: string) =>
	Console.error(`Error: ${message}`).pipe(Effect.andThen(Effect.fail(error)));

export const handleCliFailure = {
	UnsupportedVersionFlagCombination: (error: UnsupportedVersionFlagCombination) =>
		printAndFail(error, error.message),
	UnsupportedVersionFormat: (error: UnsupportedVersionFormat) =>
		printAndFail(
			error,
			`unsupported output format ${JSON.stringify(error.format)}: expected human or json`,
		),
} as const;
