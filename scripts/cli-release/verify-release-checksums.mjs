import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const assetsDir = path.resolve(
  process.env.ASSETS_DIR ?? "dist/cli-release-assets"
);
const checksumPath = path.join(assetsDir, "checksums.txt");

const requiredAssets = [
  "better-webhook-darwin-arm64",
  "better-webhook-darwin-x64",
  "better-webhook-linux-arm64",
  "better-webhook-linux-x64",
  "better-webhook-windows-x64.exe"
];

const checksumsRaw = await readFile(checksumPath, "utf8");
const checksums = new Map();
for (const line of checksumsRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed) {
    continue;
  }
  const [hash, filename] = trimmed.split(/\s+/);
  if (hash && filename) {
    checksums.set(filename, hash);
  }
}

for (const asset of requiredAssets) {
  const expected = checksums.get(asset);
  if (!expected) {
    throw new Error(`Missing checksum entry for ${asset}`);
  }

  const data = await readFile(path.join(assetsDir, asset));
  const actual = createHash("sha256").update(data).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${asset}: expected ${expected}, got ${actual}`
    );
  }
}

process.stdout.write(
  `Checksums verified for ${requiredAssets.length} release assets.\n`
);
