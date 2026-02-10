import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
  dts: true,
  clean: false, // Disabled to preserve dashboard UI copied to dist/dashboard
  outDir: "dist",
  target: "node18",
  sourcemap: false,
  minify: false,
  noExternal: ["ora", "chalk"],
});
