import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const bundlesDir = path.resolve(process.env.NPM_BUNDLES_DIR ?? "dist/cli-npm-bundles");
const smokeDir = path.resolve(process.env.SMOKE_DIR ?? "dist/cli-smoke");

const targetByPlatform = {
  "darwin-arm64": "cli-darwin-arm64",
  "darwin-x64": "cli-darwin-x64",
  "linux-arm64": "cli-linux-arm64",
  "linux-x64": "cli-linux-x64",
  "win32-x64": "cli-windows-x64"
};

const platformKey = `${process.platform}-${process.arch}`;
const platformPackageDirName = targetByPlatform[platformKey];
if (!platformPackageDirName) {
  throw new Error(`No smoke-test package mapping for ${platformKey}`);
}

const wrapperDir = path.join(bundlesDir, "cli");
const platformDir = path.join(bundlesDir, platformPackageDirName);
const wrapperExecutable = path.join(
  smokeDir,
  "node_modules/@better-webhook/cli/bin/better-webhook.cjs"
);

await rm(smokeDir, { force: true, recursive: true });
await mkdir(smokeDir, { recursive: true });

const run = (args, extra = {}) => {
  const command = spawnSync("npm", args, {
    cwd: smokeDir,
    encoding: "utf8",
    stdio: "pipe",
    ...extra
  });
  if (command.status !== 0) {
    throw new Error(
      `Command failed: npm ${args.join(" ")}\nstdout:\n${command.stdout}\nstderr:\n${command.stderr}`
    );
  }
  return command;
};

run(["init", "-y"]);
run(["install", "--omit=optional", wrapperDir]);
run(["install", platformDir]);

const smoke = spawnSync("node", [wrapperExecutable, "--version"], {
  cwd: smokeDir,
  encoding: "utf8",
  stdio: "pipe"
});
if (smoke.status !== 0) {
  throw new Error(
    `CLI smoke test failed\nstdout:\n${smoke.stdout}\nstderr:\n${smoke.stderr}`
  );
}

if (!smoke.stdout.trim()) {
  throw new Error("CLI smoke test returned empty version output.");
}

process.stdout.write(`Smoke test passed on ${platformKey}: ${smoke.stdout}`);
