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
  clean: true,
  outDir: "dist",
  target: "es2022",
  sourcemap: false,
  minify: false,
  splitting: false,
});
