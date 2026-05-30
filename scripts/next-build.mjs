import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = {
  ...process.env,
  NEXT_PUBLIC_BUILD_TIMESTAMP:
    process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? new Date().toISOString(),
};

const result = spawnSync("next", ["build"], {
  cwd: root,
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
