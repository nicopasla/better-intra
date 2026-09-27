import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const candidates = {
  darwin: [
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    join(process.env.HOME ?? "", "Applications/Brave Browser.app/Contents/MacOS/Brave Browser"),
  ],
  win32: [
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    join(process.env.LOCALAPPDATA ?? "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
  ],
  linux: ["brave-browser", "brave"],
};

const platformCandidates = candidates[process.platform] ?? [];
const binary = process.env.BRAVE_BINARY ?? platformCandidates.find((p) => existsSync(p)) ?? platformCandidates[0];

if (!binary) {
  console.error(`Unsupported platform: ${process.platform}. Set BRAVE_BINARY to the Brave executable path.`);
  process.exit(1);
}

const webExt = join(root, "node_modules", "web-ext", "bin", "web-ext.js");

const child = spawn(
  process.execPath,
  [
    webExt,
    "run",
    "-t",
    "chromium",
    "--chromium-binary",
    binary,
    "--source-dir",
    join(root, "dist-chrome"),
    "--start-url",
    "https://profile-v3.intra.42.fr",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
