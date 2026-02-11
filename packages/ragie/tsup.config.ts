import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    events: "src/events.ts",
  },
  format: ["esm", "cjs"],
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
  dts: true,
  clean: true,
  outDir: "dist",
  target: "node18",
  sourcemap: false,
  minify: false,
  splitting: true,
  treeshake: true,
  external: ["@nestjs/common", "@nestjs/core", "reflect-metadata"],
});
