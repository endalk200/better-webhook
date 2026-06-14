import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";

import { runCli } from "./cli/run.js";
import { handleCliFailure } from "./runtime/failures.js";
import { CliServicesLive } from "./services/index.js";

const MainLayer = NodeServices.layer.pipe(Layer.merge(CliServicesLive));

export const program: Effect.Effect<void, unknown, never> = runCli.pipe(
	Effect.provide(MainLayer),
	Effect.catchTags(handleCliFailure),
);
