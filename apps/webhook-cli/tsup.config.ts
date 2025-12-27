import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: false, // Disabled to preserve dashboard UI copied to dist/dashboard
  outDir: "dist",
  target: "node18",
  sourcemap: false,
  minify: false,
});
