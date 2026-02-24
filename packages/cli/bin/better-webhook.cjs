#!/usr/bin/env node

const { spawn } = require("node:child_process");

const targets = {
  "darwin-arm64": {
    packageName: "@better-webhook/cli-darwin-arm64",
    binaryPath: "bin/better-webhook"
  },
  "darwin-x64": {
    packageName: "@better-webhook/cli-darwin-x64",
    binaryPath: "bin/better-webhook"
  },
  "linux-arm64": {
    packageName: "@better-webhook/cli-linux-arm64",
    binaryPath: "bin/better-webhook"
  },
  "linux-x64": {
    packageName: "@better-webhook/cli-linux-x64",
    binaryPath: "bin/better-webhook"
  },
  "win32-x64": {
    packageName: "@better-webhook/cli-windows-x64",
    binaryPath: "bin/better-webhook.exe"
  }
};

const target = targets[`${process.platform}-${process.arch}`];

if (!target) {
  process.stderr.write(
    `Unsupported platform: ${process.platform}/${process.arch}\n`
  );
  process.stderr.write(
    "Check available binaries at https://github.com/endalk200/better-webhook/releases\n"
  );
  process.exit(1);
}

let executable;
try {
  executable = require.resolve(`${target.packageName}/${target.binaryPath}`);
} catch (error) {
  process.stderr.write(
    `Missing native binary package: ${target.packageName}\n`
  );
  process.stderr.write(
    "Try reinstalling with: npm i -g @better-webhook/cli\n"
  );
  process.exit(1);
}

const child = spawn(executable, process.argv.slice(2), {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code === null ? 1 : code);
});

child.on("error", (error) => {
  process.stderr.write(`Failed to start better-webhook: ${error.message}\n`);
  process.exit(1);
});
