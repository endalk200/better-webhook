import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, "../../dashboard/dist");
const destDir = path.resolve(__dirname, "../dist/dashboard");

async function existsDir(p) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

if (!(await existsDir(srcDir))) {
  console.error(
    `[copy-dashboard] Dashboard build output not found at: ${srcDir}\n` +
      `[copy-dashboard] Run: pnpm --filter @better-webhook/dashboard build`
  );
  process.exit(1);
}

await rm(destDir, { recursive: true, force: true });
await cp(srcDir, destDir, { recursive: true });

console.log(`[copy-dashboard] Copied ${srcDir} -> ${destDir}`);
