import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";

import {
  parseCliReleaseTag,
  renderHomebrewCask,
  stampManifestVersions,
  verifyBinaryVersion,
} from "./cli-release.mjs";

test("parseCliReleaseTag accepts prerelease tags", () => {
  assert.deepEqual(parseCliReleaseTag("cli-v2.0.0-alpha.1"), {
    tag: "cli-v2.0.0-alpha.1",
    version: "2.0.0-alpha.1",
    isPrerelease: true,
    npmTag: "next",
    githubPrerelease: true,
  });
});

test("parseCliReleaseTag rejects invalid tags", () => {
  assert.throws(() => parseCliReleaseTag("v2.0.0"), /Invalid CLI release tag/);
  assert.throws(() => parseCliReleaseTag("cli-v2"), /Invalid CLI release tag/);
  assert.throws(
    () => parseCliReleaseTag("cli-v2.0.0-preview.1"),
    /Invalid CLI release tag/,
  );
});

test("stampManifestVersions rewrites wrapper dependency versions", () => {
  const manifest = {
    name: "@better-webhook/cli",
    version: "0.0.0",
    optionalDependencies: {
      "@better-webhook/cli-darwin-arm64": "0.0.0",
      "@better-webhook/cli-linux-x64": "0.0.0",
    },
  };

  assert.deepEqual(stampManifestVersions(manifest, "2.0.0"), {
    name: "@better-webhook/cli",
    version: "2.0.0",
    optionalDependencies: {
      "@better-webhook/cli-darwin-arm64": "2.0.0",
      "@better-webhook/cli-linux-x64": "2.0.0",
    },
  });
});

test("verifyBinaryVersion fails on drift", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bw-version-test-"));
  const binaryPath = path.join(tempDir, "bw");

  await writeFile(binaryPath, "#!/bin/sh\necho 9.9.9\n");
  await chmod(binaryPath, 0o755);

  assert.throws(
    () => verifyBinaryVersion(binaryPath, "2.0.0"),
    /Version drift detected/,
  );
});

test("renderHomebrewCask includes both darwin artifacts", () => {
  const cask = renderHomebrewCask({
    version: "2.0.0",
    arm64Sha256: "arm64-checksum",
    x64Sha256: "x64-checksum",
  });

  assert.match(cask, /bw-darwin-arm64\.tar\.gz/);
  assert.match(cask, /bw-darwin-x64\.tar\.gz/);
  assert.match(cask, /version "2.0.0"/);
});

test("renderHomebrewCask fails when a darwin checksum is missing", () => {
  assert.throws(
    () =>
      renderHomebrewCask({
        version: "2.0.0",
        arm64Sha256: "arm64-checksum",
        x64Sha256: undefined,
      }),
    /Missing darwin archive checksum/,
  );
});
