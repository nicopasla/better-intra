import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: process.env.BUILD_OUT_DIR || 'dist',
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