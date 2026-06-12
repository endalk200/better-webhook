import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const generatedPath = join(packageRoot, "dist", "version.generated.js");
const generatedTypesPath = join(packageRoot, "dist", "version.generated.d.ts");

function git(args) {
	try {
		return execFileSync("git", args, {
			cwd: packageRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return undefined;
	}
}

const commit = process.env.GITHUB_SHA ?? git(["rev-parse", "--short", "HEAD"]) ?? "unknown";
const date =
	process.env.SOURCE_DATE_EPOCH === undefined
		? new Date().toISOString()
		: new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString();
const builtBy = process.env.GITHUB_ACTOR ?? process.env.USER ?? "source";

const generated = `export const COMMIT = ${JSON.stringify(commit)};\nexport const DATE = ${JSON.stringify(date)};\nexport const BUILT_BY = ${JSON.stringify(builtBy)};\n`;

await mkdir(dirname(generatedPath), { recursive: true });
await writeFile(generatedPath, generated);
await writeFile(
	generatedTypesPath,
	"export declare const COMMIT: string;\nexport declare const DATE: string;\nexport declare const BUILT_BY: string;\n",
);
