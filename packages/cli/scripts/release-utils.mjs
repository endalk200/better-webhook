import { readFile } from "node:fs/promises";

export async function readCliPackage() {
	return JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
}

export function tagVersion(tagName) {
	const match =
		/^cli\/v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(
			tagName,
		);
	if (!match) {
		throw new Error(
			`CLI release tags must match cli/v<stable-or-beta-semver>. Received ${tagName}.`,
		);
	}

	return match[1];
}

export function npmTagForVersion(version) {
	if (!version.includes("-")) {
		return "latest";
	}

	if (/^\d+\.\d+\.\d+-beta(?:\.[0-9A-Za-z-]+)*(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
		return "beta";
	}

	throw new Error(`CLI prereleases must use the beta channel. Received ${version}.`);
}
