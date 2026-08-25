import { spawnSync } from "node:child_process";
import path from "node:path";

import { validateRenderRoots, type RenderRoots } from "./paths.js";
import type { RenderJob } from "./schema.js";

export interface DockerRenderOptions extends RenderRoots {
  image: string;
  job: RenderJob;
}

export function buildDockerCommand(options: DockerRenderOptions): string[] {
  const roots = validateRenderRoots(options);
  if (!/^[a-z0-9./:@_-]+$/i.test(options.image)) throw new Error("Invalid Docker image reference");
  const manifest = path.posix.join(
    "/workspace/artifacts",
    options.job.compositionId,
    "composition.json"
  );
  const output = path.posix.join("/workspace/output", `${options.job.compositionId}.mp4`);
  return [
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--user",
    "10001:10001",
    "--cpus",
    "2",
    "--memory",
    "2g",
    "--pids-limit",
    "256",
    "--mount",
    `type=bind,src=${roots.publicRoot},dst=/workspace/public,readonly`,
    "--mount",
    `type=bind,src=${roots.artifactRoot},dst=/workspace/artifacts,readonly`,
    "--mount",
    `type=bind,src=${roots.outputRoot},dst=/workspace/output`,
    "--env",
    `VACE_COMPOSITION_MANIFEST=${manifest}`,
    "--env",
    `VACE_OUTPUT=${output}`,
    "--env",
    "VACE_PUBLIC=/workspace/public",
    options.image
  ];
}

export function runDockerRender(options: DockerRenderOptions): void {
  const args = buildDockerCommand(options);
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: options.job.timeoutMs });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || "Docker renderer failed");
}
