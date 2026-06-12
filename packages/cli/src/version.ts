export interface BuildInfo {
	readonly version: string;
	readonly commit: string;
	readonly date: string;
	readonly builtBy: string;
}

import { BUILT_BY, COMMIT, DATE, VERSION } from "./version.generated.js";

export { BUILT_BY, COMMIT, DATE, VERSION } from "./version.generated.js";

export const buildInfo: BuildInfo = {
	version: VERSION,
	commit: COMMIT,
	date: DATE,
	builtBy: BUILT_BY,
};

export const versionBanner = (build: BuildInfo = buildInfo) => `bw version ${build.version}`;
