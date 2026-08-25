import { expect, it } from "vitest";

import { canonicalJson, sha256 } from "../src/lib/canonical-json.js";

it("sorts object keys recursively without reordering arrays", () => {
  expect(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [{ d: 4, c: 5 }] })).toBe(
    '{"a":{"b":3,"y":2},"list":[{"c":5,"d":4}],"z":1}'
  );
});

it("hashes canonical bytes deterministically", () => {
  expect(sha256(canonicalJson({ b: 2, a: 1 }))).toBe(sha256(canonicalJson({ a: 1, b: 2 })));
});
