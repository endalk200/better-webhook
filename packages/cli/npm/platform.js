const platformPackages = {
  "darwin-arm64": "@better-webhook/cli-darwin-arm64",
  "darwin-x64": "@better-webhook/cli-darwin-x64",
  "linux-arm64": "@better-webhook/cli-linux-arm64",
  "linux-x64": "@better-webhook/cli-linux-x64",
  "win32-x64": "@better-webhook/cli-win32-x64",
};

/**
 * Build the lookup key for a Node platform and architecture pair.
 *
 * @param {string} [platform=process.platform] Node platform identifier.
 * @param {string} [arch=process.arch] Node architecture identifier.
 * @returns {string} Platform package lookup key.
 */
export function platformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

/**
 * Resolve the native CLI package for a Node platform and architecture pair.
 *
 * @param {string} [platform=process.platform] Node platform identifier.
 * @param {string} [arch=process.arch] Node architecture identifier.
 * @returns {string} Scoped native npm package name.
 * @throws {Error} When the platform/architecture pair is unsupported.
 */
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

/**
 * Return the CLI binary filename for a Node platform.
 *
 * @param {string} [platform=process.platform] Node platform identifier.
 * @returns {"bw" | "bw.exe"} Binary filename.
 */
export function binaryName(platform = process.platform) {
  return platform === "win32" ? "bw.exe" : "bw";
}

/**
 * Return a copy of supported platform package mappings.
 *
 * @returns {Record<string, string>} Platform lookup keys mapped to package names.
 */
export function platformPackageMap() {
  return { ...platformPackages };
}
