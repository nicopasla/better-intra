import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "Better Intra",
        namespace: "42-userscripts/nicopasla",
        match: ["https://profile-v3.intra.42.fr/*", "https://*.intra.42.fr/*"],
        grant: ["GM_getValue", "GM_setValue", "GM_deleteValue"],
        updateURL:
          "https://github.com/nicopasla/vscode-42header/releases/latest/download/better-intra.user.js",
        downloadURL:
          "https://github.com/nicopasla/NOM_REPO/releases/latest/download/better-intra.user.js",
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
