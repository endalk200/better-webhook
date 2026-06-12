#!/usr/bin/env node
import { NodeRuntime } from "@effect/platform-node";

import { program } from "./program.js";

NodeRuntime.runMain(program, {
	disableErrorReporting: true,
});
