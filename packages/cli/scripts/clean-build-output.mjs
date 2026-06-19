import { rm } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const includeCache = process.argv.includes("--cache");

const pathsToRemove = [
	rm(new URL("../dist", import.meta.url), { recursive: true, force: true }),
	rm(new URL("../tsconfig.tsbuildinfo", import.meta.url), { force: true }),
];

if (includeCache) {
	pathsToRemove.push(rm(new URL("../.turbo", import.meta.url), { recursive: true, force: true }));
}

await Promise.all(pathsToRemove);

console.log(`Cleaned CLI build output in ${packageRoot}.`);
