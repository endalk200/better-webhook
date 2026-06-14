import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
import type { BuildInfo } from "../src/version.js";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const builtBin = resolve(packageRoot, "dist/bin.js");
const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
	readonly version: string;
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

const testBuild: BuildInfo = {
	version: "9.8.7-test.1",
	commit: "abc123",
	date: "2026-04-25T00:00:00Z",
	builtBy: "test",
};

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

const runTestCommand = (args: readonly string[], build = testBuild) =>
	Effect.gen(function* () {
		yield* Command.runWith(makeRootCommand(build), {
			version: build.version,
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

		expect(stdout).toEqual(["bw version 9.8.7-test.1"]);
	});

	it("prints the version command in human format", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand(["version"]));

		expect(stdout).toEqual(["bw version 9.8.7-test.1"]);
	});

	it("prints verbose version metadata", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand(["version", "--verbose"]));

		expect(stdout).toEqual([
			"bw version 9.8.7-test.1",
			"commit: abc123",
			"date: 2026-04-25T00:00:00Z",
			"built-by: test",
		]);
	});

	it("prints machine-readable version metadata", async () => {
		const { stdout } = await Effect.runPromise(runTestCommand(["version", "--format", "json"]));

		expect(JSON.parse(stdout[0] ?? "")).toEqual({
			schemaVersion: "1",
			command: "version",
			version: "9.8.7-test.1",
			commit: "abc123",
			date: "2026-04-25T00:00:00Z",
			builtBy: "test",
		});
	});

	it("rejects verbose JSON format", async () => {
		await expect(
			Effect.runPromise(runTestCommand(["version", "--verbose", "--format", "json"])),
		).rejects.toMatchObject({
			_tag: "UnsupportedVersionFlagCombination",
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

	it("reports parse errors and exits nonzero", () => {
		expect(existsSync(builtBin), "run bun --filter @better-webhook/cli build first").toBe(true);

		const command = spawnSync(process.execPath, [builtBin, "missing"], { encoding: "utf8" });
		const output = `${command.stdout}${command.stderr}`;

		expect(command.status).toBe(1);
		expect(output).toContain('Unknown subcommand "missing" for "bw"');
	});

	it("initializes a project and adds an endpoint", async () => {
		const project = await mkdtemp(resolve(tmpdir(), "bw-project-"));
		try {
			const init = runBuilt(["init", "--project", project, "--format", "json"]);
			expect(init.status).toBe(0);
			expect(JSON.parse(init.stdout)).toMatchObject({
				schemaVersion: "1",
				command: "init",
				data: {
					projectRoot: project,
				},
			});

			const added = runBuilt([
				"endpoint",
				"add",
				"--project",
				project,
				"--id",
				"stripe-main",
				"--route",
				"/stripe",
				"--target",
				"http://127.0.0.1:3000/webhook",
				"--provider",
				"stripe",
				"--secret-env",
				"STRIPE_SECRET",
				"--format",
				"json",
			]);
			expect(added.status).toBe(0);
			expect(JSON.parse(added.stdout)).toMatchObject({
				schemaVersion: "1",
				command: "endpoint.add",
				data: {
					endpoint: {
						id: "stripe-main",
						provider: "stripe",
						route: "/stripe",
						targetUrl: "http://127.0.0.1:3000/webhook",
					},
				},
			});
		} finally {
			await rm(project, { recursive: true, force: true });
		}
	});

	it("rejects public remote endpoint targets", async () => {
		const project = await mkdtemp(resolve(tmpdir(), "bw-project-"));
		try {
			expect(runBuilt(["init", "--project", project]).status).toBe(0);
			const result = runBuilt([
				"endpoint",
				"add",
				"--project",
				project,
				"--id",
				"unsafe",
				"--route",
				"/unsafe",
				"--target",
				"https://example.com/webhook",
			]);
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("public remote targets are blocked");
		} finally {
			await rm(project, { recursive: true, force: true });
		}
	});
});

const runBuilt = (
	args: readonly string[],
	options: { readonly env?: Record<string, string> } = {},
) =>
	spawnSync(process.execPath, [builtBin, ...args], {
		encoding: "utf8",
		env: { ...process.env, ...options.env },
	});
