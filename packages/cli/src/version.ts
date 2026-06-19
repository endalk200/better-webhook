import { createRequire } from "node:module";

import { BUILT_BY, COMMIT, DATE } from "./version.generated.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { readonly version: string };

export interface BuildInfo {
	readonly version: string;
	readonly commit: string;
	readonly date: string;
	readonly builtBy: string;
}

export const buildInfo: BuildInfo = {
	version: packageJson.version,
	commit: COMMIT,
	date: DATE,
	builtBy: BUILT_BY,
};

export const versionBanner = (build: BuildInfo = buildInfo) => `bw version ${build.version}`;
