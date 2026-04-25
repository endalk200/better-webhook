import { readFile } from "node:fs/promises";

export const platforms = [
  {
    goos: "darwin",
    goarch: "arm64",
    nodePlatform: "darwin",
    nodeArch: "arm64",
    packageName: "@better-webhook/cli-darwin-arm64",
    binaryName: "bw",
  },
  {
    goos: "darwin",
    goarch: "amd64",
    nodePlatform: "darwin",
    nodeArch: "x64",
    packageName: "@better-webhook/cli-darwin-x64",
    binaryName: "bw",
  },
  {
    goos: "linux",
    goarch: "arm64",
    nodePlatform: "linux",
    nodeArch: "arm64",
    packageName: "@better-webhook/cli-linux-arm64",
    binaryName: "bw",
  },
  {
    goos: "linux",
    goarch: "amd64",
    nodePlatform: "linux",
    nodeArch: "x64",
    packageName: "@better-webhook/cli-linux-x64",
    binaryName: "bw",
  },
  {
    goos: "windows",
    goarch: "amd64",
    nodePlatform: "win32",
    nodeArch: "x64",
    packageName: "@better-webhook/cli-win32-x64",
    binaryName: "bw.exe",
  },
];

export async function readCliPackage() {
  return JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
}

export function tagVersion(tagName) {
  const match = /^cli\/v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(tagName);
  if (!match) {
    throw new Error(`CLI release tags must match cli/v<stable-or-beta-semver>. Received ${tagName}.`);
  }

  return match[1];
}

export function npmTagForVersion(version) {
  if (!version.includes("-")) {
    return "latest";
  }

  if (/^\d+\.\d+\.\d+-beta(?:\.[0-9A-Za-z-]+)*(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    return "beta";
  }

  throw new Error(`CLI prereleases must use the beta channel. Received ${version}.`);
}
