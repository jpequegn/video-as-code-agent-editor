import path from "node:path";

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export interface RenderRoots {
  artifactRoot: string;
  publicRoot: string;
  outputRoot: string;
}

export function validateRenderRoots(roots: RenderRoots): RenderRoots {
  const resolved = {
    artifactRoot: path.resolve(roots.artifactRoot),
    publicRoot: path.resolve(roots.publicRoot),
    outputRoot: path.resolve(roots.outputRoot)
  };
  const readRoots = [resolved.artifactRoot, resolved.publicRoot];
  for (const readRoot of readRoots) {
    if (
      readRoot === resolved.outputRoot ||
      isWithin(readRoot, resolved.outputRoot) ||
      isWithin(resolved.outputRoot, readRoot)
    ) {
      throw new Error("Render output must not overlap read-only source or artifact roots");
    }
  }
  return resolved;
}

export function resolveOutputFile(outputRoot: string, relativeFile: string): string {
  const root = path.resolve(outputRoot);
  const output = path.resolve(root, relativeFile);
  if (!isWithin(root, output)) throw new Error("Render output escapes the output root");
  return output;
}
