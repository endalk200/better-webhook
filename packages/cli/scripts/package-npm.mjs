import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readCliPackage } from "./release-utils.mjs";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distRoot = join(packageRoot, "dist", "npm");
const packageJson = await readCliPackage();
const readme = await readFile(join(packageRoot, "README.md"), "utf8");
const license = await readFile(join(packageRoot, "LICENSE"), "utf8");

async function copyCompiledOutput(target) {
	const compiledRoot = join(packageRoot, "dist");
	const entries = await readdir(compiledRoot, { withFileTypes: true });

	await mkdir(target, { recursive: true });

	for (const entry of entries) {
		if (entry.name === "npm") {
			continue;
		}

		await cp(join(compiledRoot, entry.name), join(target, entry.name), { recursive: true });
	}
}

await rm(distRoot, { recursive: true, force: true });
const wrapperDir = join(distRoot, "cli");

await mkdir(wrapperDir, { recursive: true });
await copyCompiledOutput(join(wrapperDir, "dist"));
await writeFile(join(wrapperDir, "README.md"), readme);
await writeFile(join(wrapperDir, "LICENSE"), license);
await writeFile(
	join(wrapperDir, "package.json"),
	`${JSON.stringify(
		{
			...packageJson,
			private: undefined,
			scripts: undefined,
			devDependencies: undefined,
		},
		null,
		2,
	)}\n`,
);

console.log(`Created npm package directory in ${wrapperDir}.`);
