import { defineConfig } from "vite";
import { resolve } from "path";

const outDir = process.env.BUILD_OUT_DIR || "dist";

export default defineConfig({
  build: {
    outDir: outDir,
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: { background: resolve(__dirname, "src/background.ts") },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});