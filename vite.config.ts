import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import fs from "fs";
import pkg from "./package.json";

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: "update-manifest-version",
      closeBundle() {
        const manifestPath = resolve(__dirname, "dist/manifest.json");
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          manifest.version = pkg.version;
          fs.writeFileSync(
            manifestPath,
            JSON.stringify(manifest, null, 2),
            "utf-8",
          );
          console.log(
            `\nmanifest.json and hubSettings.data synced with v${pkg.version}\n`,
          );
        }
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/main.ts"),
      },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
