import { chmod } from "node:fs/promises";

if (process.platform !== "win32") {
	await chmod(new URL("../dist/bin.js", import.meta.url), 0o755);
}
