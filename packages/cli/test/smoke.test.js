import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const binary = resolve(
  packageRoot,
  process.platform === "win32" ? "bin/bw.exe" : "bin/bw",
);
const packageJson = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
);
const expectedVersion = `bw version ${packageJson.version}\n`;

test("local binary reports version from command and flag", () => {
  assert.equal(
    existsSync(binary),
    true,
    "run pnpm --filter @better-webhook/cli build before smoke tests",
  );

  const command = spawnSync(binary, ["version"], { encoding: "utf8" });
  assert.equal(command.status, 0);
  assert.equal(command.stdout, expectedVersion);

  const flag = spawnSync(binary, ["--version"], { encoding: "utf8" });
  assert.equal(flag.status, 0);
  assert.equal(flag.stdout, expectedVersion);
});

test("local binary reports machine-readable version", () => {
  assert.equal(
    existsSync(binary),
    true,
    "run pnpm --filter @better-webhook/cli build before smoke tests",
  );

  const command = spawnSync(binary, ["version", "--format", "json"], {
    encoding: "utf8",
  });
  assert.equal(command.status, 0);
  assert.deepEqual(JSON.parse(command.stdout), {
    schemaVersion: "1",
    command: "version",
    version: packageJson.version,
    commit: "unknown",
    date: "unknown",
    builtBy: "source",
  });
});
