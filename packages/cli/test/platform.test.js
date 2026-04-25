import assert from "node:assert/strict";
import test from "node:test";

import {
  binaryName,
  packageNameForPlatform,
  platformPackageMap,
} from "../npm/platform.js";

test("resolves supported platform packages", () => {
  assert.equal(
    packageNameForPlatform("darwin", "arm64"),
    "@better-webhook/cli-darwin-arm64",
  );
  assert.equal(
    packageNameForPlatform("darwin", "x64"),
    "@better-webhook/cli-darwin-x64",
  );
  assert.equal(
    packageNameForPlatform("linux", "arm64"),
    "@better-webhook/cli-linux-arm64",
  );
  assert.equal(
    packageNameForPlatform("linux", "x64"),
    "@better-webhook/cli-linux-x64",
  );
  assert.equal(
    packageNameForPlatform("win32", "x64"),
    "@better-webhook/cli-win32-x64",
  );
});

test("throws a clear error for unsupported platforms", () => {
  assert.throws(
    () => packageNameForPlatform("freebsd", "x64"),
    /Unsupported platform freebsd-x64/,
  );
});

test("uses the Windows binary extension only on Windows", () => {
  assert.equal(binaryName("win32"), "bw.exe");
  assert.equal(binaryName("linux"), "bw");
  assert.equal(binaryName("darwin"), "bw");
});

test("exposes every platform package in the wrapper optional dependencies", () => {
  assert.deepEqual(Object.keys(platformPackageMap()).sort(), [
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "win32-x64",
  ]);
});
