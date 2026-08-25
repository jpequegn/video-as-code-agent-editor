import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function run(command, args, extraEnvironment = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnvironment }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "check"]);
run("npm", ["run", "build"]);
const binDirectory = path.join(
  process.cwd(),
  ".venv",
  process.platform === "win32" ? "Scripts" : "bin"
);
run(path.join(binDirectory, process.platform === "win32" ? "ruff.exe" : "ruff"), ["check", "."]);
run(path.join(binDirectory, process.platform === "win32" ? "pytest.exe" : "pytest"), [], {
  PYTHONPATH: path.join(process.cwd(), "python", "src")
});

const workspace = mkdtempSync(path.join(os.tmpdir(), "vace-release-"));
run("node", [
  "dist/src/cli.js",
  "--output",
  "status",
  "demo",
  "--approve",
  "--renderer",
  "fixture",
  "--workspace",
  workspace
]);

process.stdout.write(`Release verification passed. Demo artifacts: ${workspace}\n`);
