import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ContentStore } from "../src/media/content-store.js";

describe("ContentStore", () => {
  it("deduplicates identical bytes and preserves changed bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vace-store-"));
    const source = path.join(root, "source.bin");
    const store = new ContentStore(path.join(root, "store"));
    await writeFile(source, "first");
    const first = await store.ingest(source);
    const duplicate = await store.ingest(source);
    expect(duplicate).toEqual(first);
    await writeFile(source, "second");
    const second = await store.ingest(source);
    expect(second.digest).not.toBe(first.digest);
    expect(await readFile(store.resolve(first), "utf8")).toBe("first");
  });
});
