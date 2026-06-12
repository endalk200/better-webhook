import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";

import { runCli } from "./cli/run.js";
import { handleCliFailure } from "./runtime/failures.js";

const MainLayer = NodeServices.layer;

export const program: Effect.Effect<void, unknown, never> = runCli.pipe(
	Effect.provide(MainLayer),
	Effect.catchTags(handleCliFailure),
);
