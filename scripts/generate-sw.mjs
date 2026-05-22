import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function getCacheVersion() {
  if (process.env.SW_CACHE_VERSION) {
    return process.env.SW_CACHE_VERSION.replace(/[^a-zA-Z0-9_-]/g, "");
  }

  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

const cacheVersion = getCacheVersion();
const template = readFileSync(join(__dirname, "sw.template.js"), "utf8");
const output = template.replaceAll("__CACHE_VERSION__", cacheVersion);

writeFileSync(join(root, "public", "sw.js"), output);
console.log(`[generate-sw] public/sw.js (cache: ${cacheVersion})`);
