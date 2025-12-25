import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  outDir: "dist",
  target: "node18",
  sourcemap: false,
  minify: false,
  splitting: false,
  external: ["@nestjs/common", "@nestjs/core", "reflect-metadata"],
});

