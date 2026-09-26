import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Configure the environment before loading tools that cache os.tmpdir() on import.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectory = join(root, ".cache", "tmp");
const cacheDirectory = join(root, ".cache", "xdg");
const browserDirectory = join(root, ".browsers");
const runtimeDirectory = join(root, ".cache", "runtime");
for (const directory of [
  temporaryDirectory,
  cacheDirectory,
  browserDirectory,
  runtimeDirectory,
]) {
  mkdirSync(directory, { recursive: true });
}
const [command, ...args] = process.argv.slice(2);
const entries = {
  jest: "jest/bin/jest.js",
  playwright: "@playwright/test/cli.js",
  vite: "vite/bin/vite.js",
  tsc: "typescript/bin/tsc",
  eslint: "eslint/bin/eslint.js",
};
const entry = entries[command];
if (!entry) throw new Error("Expected jest, playwright, vite, tsc or eslint.");
const child = spawn(
  process.execPath,
  [join(root, "node_modules", entry), ...args],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      TMPDIR: temporaryDirectory,
      TMP: temporaryDirectory,
      TEMP: temporaryDirectory,
      XDG_CACHE_HOME: cacheDirectory,
      XDG_RUNTIME_DIR: runtimeDirectory,
      GSETTINGS_BACKEND: "memory",
      ...(process.platform === "linux"
        ? { FONTCONFIG_FILE: join(root, "scripts", "fonts.conf") }
        : {}),
      PLAYWRIGHT_BROWSERS_PATH: browserDirectory,
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
