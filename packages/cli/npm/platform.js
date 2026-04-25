const platformPackages = {
  "darwin-arm64": "@better-webhook/cli-darwin-arm64",
  "darwin-x64": "@better-webhook/cli-darwin-x64",
  "linux-arm64": "@better-webhook/cli-linux-arm64",
  "linux-x64": "@better-webhook/cli-linux-x64",
  "win32-x64": "@better-webhook/cli-win32-x64",
};

export function platformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

export function packageNameForPlatform(
  platform = process.platform,
  arch = process.arch,
) {
  const key = platformKey(platform, arch);
  const packageName = platformPackages[key];

  if (!packageName) {
    throw new Error(
      `Unsupported platform ${key}. Supported platforms: ${Object.keys(platformPackages).join(", ")}.`,
    );
  }

  return packageName;
}

export function binaryName(platform = process.platform) {
  return platform === "win32" ? "bw.exe" : "bw";
}

export function platformPackageMap() {
  return { ...platformPackages };
}
