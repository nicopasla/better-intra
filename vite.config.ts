import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import fs from "fs";
import pkg from "./package.json";

const target = (process.env.TARGET || "firefox") as "firefox" | "chrome";
const outDir = process.env.BUILD_OUT_DIR || "dist";

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: "write-manifest",
      closeBundle() {
        const manifestSrc = resolve(
          __dirname,
          `manifests/manifest.${target}.json`,
        );
        const manifestDst = resolve(__dirname, `${outDir}/manifest.json`);

        if (!fs.existsSync(manifestSrc)) {
          console.error(`\nManifest not found: ${manifestSrc}\n`);
          return;
        }

        const manifest = JSON.parse(fs.readFileSync(manifestSrc, "utf-8"));
        manifest.version = pkg.version;
        fs.writeFileSync(
          manifestDst,
          JSON.stringify(manifest, null, 2),
          "utf-8",
        );
        console.log(`\nmanifest.json written for ${target} v${pkg.version}\n`);
      },
    },
  ],
  build: {
    outDir: outDir,
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: { content: resolve(__dirname, "src/main.ts") },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __TS_VERSION__: JSON.stringify(pkg.devDependencies.typescript),
    __VITE_VERSION__: JSON.stringify(pkg.devDependencies.vite),
    __LIT_VERSION__: JSON.stringify(pkg.dependencies["lit-html"]),
    __TW_VERSION__: JSON.stringify(pkg.dependencies["@tailwindcss/vite"]),
    __DAISY_VERSION__: JSON.stringify(pkg.devDependencies.daisyui),
    __WEB_EXT_VERSION__: JSON.stringify(pkg.devDependencies["web-ext"]),
  },
});
