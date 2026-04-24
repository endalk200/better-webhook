#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

const packageMatrix = {
  darwin: {
    arm64: "@better-webhook/cli-darwin-arm64",
    x64: "@better-webhook/cli-darwin-x64",
  },
  linux: {
    arm64: "@better-webhook/cli-linux-arm64",
    x64: "@better-webhook/cli-linux-x64",
  },
  win32: {
    x64: "@better-webhook/cli-windows-x64",
  },
};

const packageName = packageMatrix[process.platform]?.[process.arch];
if (!packageName) {
  console.error(
    `@better-webhook/cli does not support ${process.platform}-${process.arch}.`,
  );
  process.exit(1);
}

const binaryName = process.platform === "win32" ? "bw.exe" : "bw";

let binaryPath;
try {
  binaryPath = require.resolve(`${packageName}/bin/${binaryName}`);
} catch (error) {
  console.error(`Unable to resolve the native package ${packageName}.`);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start ${binaryName}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
