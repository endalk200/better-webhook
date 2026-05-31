import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const binary = resolve(packageRoot, process.platform === "win32" ? "bin/bw.exe" : "bin/bw");

test("project, template run, gateway capture, and replay work through the built binary", async (t) => {
	const projectDir = await mkdtemp(resolve(tmpdir(), "bw-project-"));
	const templateHome = await mkdtemp(resolve(tmpdir(), "bw-templates-"));
	const gatewayPort = await freePort();
	const deliveries = [];
	const target = http.createServer((request, response) => {
		let body = "";
		request.setEncoding("utf8");
		request.on("data", (chunk) => {
			body += chunk;
		});
		request.on("end", () => {
			deliveries.push({
				body,
				method: request.method,
				url: request.url,
				manual: request.headers["x-manual"],
			});
			response.writeHead(209, { "content-type": "text/plain" });
			response.end("ok");
		});
	});
	await listen(target);
	const targetURL = `http://127.0.0.1:${target.address().port}/receive`;
	t.after(() => {
		target.close();
	});

	const init = run([
		"--format",
		"json",
		"init",
		"--dir",
		projectDir,
		"--name",
		"node-smoke",
		"--port",
		String(gatewayPort),
	]);
	assert.equal(init.command, "init");

	const endpoint = run([
		"--format",
		"json",
		"--project",
		projectDir,
		"endpoint",
		"create",
		"--id",
		"generic-main",
		"--target",
		targetURL,
		"--route",
		"/incoming",
	]);
	assert.equal(endpoint.command, "endpoint.create");

	const templateRun = await runAsync([
		"--format",
		"json",
		"--project",
		projectDir,
		"--template-home",
		templateHome,
		"templates",
		"run",
		"generic/json",
		"--endpoint",
		"generic-main",
	]);
	assert.equal(templateRun.command, "templates.run");
	assert.equal(templateRun.data.delivery.statusCode, 209);

	const gateway = spawn(binary, ["--project", projectDir, "dev"], {
		stdio: ["ignore", "pipe", "pipe"],
	});
	t.after(() => {
		gateway.kill();
	});
	let stdout = "";
	let stderr = "";
	gateway.stdout.on("data", (chunk) => {
		stdout += chunk;
	});
	gateway.stderr.on("data", (chunk) => {
		stderr += chunk;
	});

	try {
		const live = await postWithRetry(`http://127.0.0.1:${gatewayPort}/incoming?real=1`, {
			body: "raw-capture",
			headers: { "x-manual": "yes" },
			method: "POST",
		});
		assert.equal(live.status, 209);
		assert.equal(await live.text(), "ok");

		const captures = run(["--format", "json", "--project", projectDir, "capture", "list"]);
		assert.equal(captures.command, "capture.list");
		assert.equal(captures.data.captures.length, 1);
		assert.equal(captures.data.captures[0].request.rawQuery, "real=1");

		const replay = await runAsync([
			"--format",
			"json",
			"--project",
			projectDir,
			"replay",
			captures.data.captures[0].id,
		]);
		assert.equal(replay.command, "replay");
		assert.equal(replay.data.mode, "exact");
		assert.equal(replay.data.delivery.statusCode, 209);

		assert.equal(deliveries.length, 3);
		assert.match(deliveries[0].body, /better-webhook local template/);
		assert.equal(deliveries[1].body, "raw-capture");
		assert.equal(deliveries[1].manual, "yes");
		assert.equal(deliveries[2].body, "raw-capture");
	} finally {
		gateway.kill();
	}

	if (gateway.exitCode && gateway.exitCode !== 0) {
		assert.fail(`gateway failed with stdout=${stdout} stderr=${stderr}`);
	}
});

test("machine mode errors are structured through the built binary", () => {
	const missingProject = resolve(tmpdir(), `bw-missing-project-${Date.now()}`);
	const result = spawnSync(
		binary,
		["--format", "json", "--project", missingProject, "endpoint", "list"],
		{
			encoding: "utf8",
		},
	);

	assert.notEqual(result.status, 0);
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.schemaVersion, "1");
	assert.equal(parsed.ok, false);
	assert.match(parsed.error.message, /no such file or directory|cannot find/i);
	assert.equal(result.stderr, "");
});

function run(args) {
	const result = spawnSync(binary, args, { encoding: "utf8" });
	assert.equal(
		result.status,
		0,
		`bw ${args.join(" ")} failed\nstdout=${result.stdout}\nstderr=${result.stderr}`,
	);
	const parsed = JSON.parse(result.stdout);
	assert.equal(parsed.schemaVersion, "1");
	assert.equal(parsed.ok, true);
	return parsed;
}

function runAsync(args) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", rejectPromise);
		child.on("close", (status) => {
			try {
				assert.equal(status, 0, `bw ${args.join(" ")} failed\nstdout=${stdout}\nstderr=${stderr}`);
				const parsed = JSON.parse(stdout);
				assert.equal(parsed.schemaVersion, "1");
				assert.equal(parsed.ok, true);
				resolvePromise(parsed);
			} catch (error) {
				rejectPromise(error);
			}
		});
	});
}

function listen(server) {
	return new Promise((resolvePromise, rejectPromise) => {
		server.once("error", rejectPromise);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", rejectPromise);
			resolvePromise();
		});
	});
}

function close(server) {
	return new Promise((resolvePromise, rejectPromise) => {
		server.close((error) => {
			if (error) {
				rejectPromise(error);
				return;
			}
			resolvePromise();
		});
	});
}

async function postWithRetry(url, options) {
	let lastError;
	for (let attempt = 0; attempt < 30; attempt++) {
		try {
			return await fetch(url, options);
		} catch (error) {
			lastError = error;
			await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
		}
	}
	throw lastError;
}

async function freePort() {
	const server = http.createServer();
	await listen(server);
	const { port } = server.address();
	await close(server);
	return port;
}
