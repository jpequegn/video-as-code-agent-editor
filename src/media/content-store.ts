import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import type { ContentReference, MediaManifest } from "./schema.js";

export class ContentStore {
  public constructor(private readonly root: string) {}

  public async ingest(sourcePath: string): Promise<ContentReference> {
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) {
      throw new Error(`Source is not a regular file: ${sourcePath}`);
    }

    const bytes = await readFile(sourcePath);
    const digest = sha256(bytes);
    const relativePath = path.posix.join("objects", "sha256", digest.slice(0, 2), digest);
    const targetPath = path.join(this.root, ...relativePath.split("/"));
    await mkdir(path.dirname(targetPath), { recursive: true });

    try {
      await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      const stored = await readFile(targetPath);
      if (sha256(stored) !== digest) {
        throw new Error(`Content-addressed object is corrupt: ${relativePath}`);
      }
    }

    return { algorithm: "sha256", digest, bytes: sourceStat.size, objectPath: relativePath };
  }

  public resolve(reference: ContentReference): string {
    return path.join(this.root, ...reference.objectPath.split("/"));
  }

  public async has(reference: ContentReference): Promise<boolean> {
    try {
      await access(this.resolve(reference));
      return true;
    } catch {
      return false;
    }
  }

  public async writeManifest(manifest: MediaManifest): Promise<string> {
    const directory = path.join(this.root, "manifests");
    const target = path.join(directory, `${manifest.manifestId}.json`);
    await mkdir(directory, { recursive: true });
    const body = `${canonicalJson(manifest)}\n`;
    try {
      await writeFile(target, body, { flag: "wx" });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      if ((await readFile(target, "utf8")) !== body) {
        throw new Error(`Manifest identity collision: ${manifest.manifestId}`);
      }
    }
    return target;
  }
}
