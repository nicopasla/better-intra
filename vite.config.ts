import { defineConfig } from "vite";
import tailwindcss from '@tailwindcss/vite';
import monkey from "vite-plugin-monkey";

export default defineConfig({
  plugins: [
    tailwindcss(),
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "Better Intra",
        namespace: "better-intra/nicopasla",
        match: ["https://profile-v3.intra.42.fr/*", "https://*.intra.42.fr/*"],
        grant: ["GM_getValue", "GM_setValue", "GM_deleteValue"],
        updateURL:
          "https://github.com/nicopasla/better-intra/releases/latest/download/better-intra.user.js",
        downloadURL:
          "https://github.com/nicopasla/better-intra/releases/latest/download/better-intra.user.js",
      },

      build: {
        autoGrant: true,
        fileName: "better-intra.user.js",
      },
      server: {
        open: true,
      },
    }),
  ],
});
