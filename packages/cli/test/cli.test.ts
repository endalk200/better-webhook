import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Effect, FileSystem, Layer, Path, Stdio, Terminal } from "effect";
import { TestConsole } from "effect/testing";
import { CliOutput, Command } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, it } from "vitest";

import { makeRootCommand } from "../src/cli/root.js";
import { normalizeCliArgs, runCliWithArgs } from "../src/cli/run.js";
import { handleCliFailure } from "../src/runtime/failures.js";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const builtBin = resolve(packageRoot, "dist/bin.js");
const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
	readonly dependencies: Record<string, string>;
	readonly version: string;
};
const releaseUtils = (await import(
	pathToFileURL(resolve(packageRoot, "scripts/release-utils.mjs")).href
)) as {
	readonly npmTagForVersion: (version: string) => string;
	readonly tagVersion: (tagName: string) => string;
};

interface GeneratedBuildInfo {
	readonly COMMIT: string;
	readonly DATE: string;
	readonly BUILT_BY: string;
}

const readGeneratedBuildInfo = async () =>
	(await import(
		pathToFileURL(resolve(packageRoot, "dist/version.generated.js")).href
	)) as GeneratedBuildInfo;

const terminalLayer = Layer.succeed(
	Terminal.Terminal,
	Terminal.make({
		columns: Effect.succeed(80),
		rows: Effect.succeed(24),
		display: () => Effect.void,
		readInput: Effect.die("readInput is not implemented in CLI tests"),
		readLine: Effect.succeed(""),
	}),
);

const spawnerLayer = Layer.succeed(
	ChildProcessSpawner.ChildProcessSpawner,
	ChildProcessSpawner.make(() =>
		Effect.die("Child process spawning is not implemented in CLI tests"),
	),
);

const cliTestLayer = Layer.mergeAll(
	TestConsole.layer,
	FileSystem.layerNoop({}),
	Path.layer,
	terminalLayer,
	CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
	spawnerLayer,
	Stdio.layerTest({}),
);

const runTestCommand = (args: readonly string[]) =>
	Effect.gen(function* () {
		yield* Command.runWith(makeRootCommand(), {
			version: packageJson.version,
		})(normalizeCliArgs(args));

		return {
			stdout: yield* TestConsole.logLines,
			stderr: yield* TestConsole.errorLines,
		};
	}).pipe(Effect.provide(cliTestLayer));

describe("bw CLI", () => {
	it("prints root help and succeeds when invoked without arguments", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand([]));
		const stdoutText = stdout.join("\n");

		expect(stdoutText).toContain("bw <subcommand> [flags]");
		expect(stdoutText).toContain("better-webhook command line interface");
		expect(stdoutText).toContain("version");
	});

	it("prints the version from the built-in version flag", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand(["--version"]));

		expect(stdout).toEqual([`bw version ${packageJson.version}`]);
	});

	it("prints the version command in human format", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand(["version"]));

		expect(stdout).toEqual([`bw version ${packageJson.version}`]);
	});

	it("prints verbose version metadata", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand(["version", "--verbose"]));

		expect(stdout).toEqual([
			`bw version ${packageJson.version}`,
			"commit: unknown",
			"date: unknown",
			"built-by: source",
		]);
	});

	it("prints machine-readable version metadata", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand(["version", "--format", "json"]));

		expect(JSON.parse(stdout[0] ?? "")).toEqual({
			schemaVersion: "1",
			command: "version",
			version: packageJson.version,
			commit: "unknown",
			date: "unknown",
			builtBy: "source",
		});
	});

	it("rejects verbose JSON format", async () => {
		await expect(
			Effect.runPromise(runTestCommand(["version", "--verbose", "--format", "json"])),
		).rejects.toMatchObject({
			_tag: "CliFailure",
		});
	});

	it("prints CLI failures through the failure reporter", async () => {
		const { stderr } = await Effect.runPromise(
			runCliWithArgs(["version", "--verbose", "--format", "json"]).pipe(
				Effect.catchTags(handleCliFailure),
				Effect.flip,
				Effect.andThen(() =>
					Effect.gen(function* () {
						return {
							stdout: yield* TestConsole.logLines,
							stderr: yield* TestConsole.errorLines,
						};
					}),
				),
				Effect.provide(cliTestLayer),
			),
		);

		expect(stderr).toEqual([
			"Error: unsupported flag combination: --verbose only applies to human format",
		]);
	});

	it("fails unknown commands", async () => {
		await expect(Effect.runPromise(runTestCommand(["missing"]))).rejects.toBeDefined();
	});
});

describe("built bw CLI", () => {
	it("prints root help", () => {
		expect(existsSync(builtBin), "run bun --filter @better-webhook/cli build first").toBe(true);

		const command = spawnSync(process.execPath, [builtBin], { encoding: "utf8" });

		expect(command.status).toBe(0);
		expect(command.stdout).toContain("bw <subcommand> [flags]");
		expect(command.stdout).toContain("better-webhook command line interface");
	});

	it("reports version from command and flag", () => {
		expect(existsSync(builtBin), "run bun --filter @better-webhook/cli build first").toBe(true);

		const command = spawnSync(process.execPath, [builtBin, "version"], { encoding: "utf8" });
		expect(command.status).toBe(0);
		expect(command.stdout).toBe(`bw version ${packageJson.version}\n`);

		const flag = spawnSync(process.execPath, [builtBin, "--version"], { encoding: "utf8" });
		expect(flag.status).toBe(0);
		expect(flag.stdout).toBe(`bw version ${packageJson.version}\n`);
	});

	it("reports machine-readable version metadata", async () => {
		expect(existsSync(builtBin), "run bun --filter @better-webhook/cli build first").toBe(true);
		const generated = await readGeneratedBuildInfo();

		const command = spawnSync(process.execPath, [builtBin, "version", "--format", "json"], {
			encoding: "utf8",
		});

		expect(command.status).toBe(0);
		expect(JSON.parse(command.stdout)).toEqual({
			schemaVersion: "1",
			command: "version",
			version: packageJson.version,
			commit: generated.COMMIT,
			date: generated.DATE,
			builtBy: generated.BUILT_BY,
		});
	});

	it("reports verbose version metadata", async () => {
		expect(existsSync(builtBin), "run bun --filter @better-webhook/cli build first").toBe(true);
		const generated = await readGeneratedBuildInfo();

		const command = spawnSync(process.execPath, [builtBin, "version", "--verbose"], {
			encoding: "utf8",
		});

		expect(command.status).toBe(0);
		expect(command.stdout).toBe(
			[
				`bw version ${packageJson.version}`,
				`commit: ${generated.COMMIT}`,
				`date: ${generated.DATE}`,
				`built-by: ${generated.BUILT_BY}`,
				"",
			].join("\n"),
		);
	});

	it("rejects invalid built CLI flag values", () => {
		expect(existsSync(builtBin), "run bun --filter @better-webhook/cli build first").toBe(true);

		const command = spawnSync(process.execPath, [builtBin, "version", "--format", "xml"], {
			encoding: "utf8",
		});
		const output = `${command.stdout}${command.stderr}`;

		expect(command.status).toBe(1);
		expect(output).toContain('Invalid value for flag --format: "xml"');
		expect(output).toContain('Expected "human" | "json"');
	});

	it("reports parse errors and exits nonzero", () => {
		expect(existsSync(builtBin), "run bun --filter @better-webhook/cli build first").toBe(true);

		const command = spawnSync(process.execPath, [builtBin, "missing"], { encoding: "utf8" });
		const output = `${command.stdout}${command.stderr}`;

		expect(command.status).toBe(1);
		expect(output).toContain('Unknown subcommand "missing" for "bw"');
	});
});

describe("CLI release scripts", () => {
	it("parses annotated CLI release tag versions", () => {
		expect(releaseUtils.tagVersion("cli/v2.0.0")).toBe("2.0.0");
		expect(releaseUtils.tagVersion("cli/v2.0.0-beta.6")).toBe("2.0.0-beta.6");
		expect(releaseUtils.tagVersion("cli/v2.0.0+build.1")).toBe("2.0.0+build.1");
		expect(() => releaseUtils.tagVersion("v2.0.0")).toThrow(
			"CLI release tags must match cli/v<stable-or-beta-semver>",
		);
	});

	it("maps CLI versions to npm dist-tags", () => {
		expect(releaseUtils.npmTagForVersion("2.0.0")).toBe("latest");
		expect(releaseUtils.npmTagForVersion("2.0.0-beta.6")).toBe("beta");
		expect(() => releaseUtils.npmTagForVersion("2.0.0-alpha.1")).toThrow(
			"CLI prereleases must use the beta channel",
		);
	});

	it("generates a publishable npm package directory", async () => {
		const command = spawnSync(process.execPath, ["scripts/package-npm.mjs"], {
			cwd: packageRoot,
			encoding: "utf8",
		});

		expect(command.status).toBe(0);
		expect(command.stdout).toContain("Created npm package directory");

		const generatedPackageJson = JSON.parse(
			await readFile(resolve(packageRoot, "dist/npm/cli/package.json"), "utf8"),
		) as Record<string, unknown>;

		expect(generatedPackageJson.name).toBe("@better-webhook/cli");
		expect(generatedPackageJson.version).toBe(packageJson.version);
		expect(generatedPackageJson.private).toBeUndefined();
		expect(generatedPackageJson.scripts).toBeUndefined();
		expect(generatedPackageJson.devDependencies).toBeUndefined();
		expect(generatedPackageJson.bin).toEqual({ bw: "./dist/bin.js" });
		expect(generatedPackageJson.dependencies).toEqual(packageJson.dependencies);
	});

	it("dry-runs packing the generated npm package", () => {
		const command = spawnSync("npm", ["pack", resolve(packageRoot, "dist/npm/cli"), "--dry-run"], {
			encoding: "utf8",
		});

		expect(command.status).toBe(0);
		expect(command.stdout).toContain(`better-webhook-cli-${packageJson.version}.tgz`);
	});
});
