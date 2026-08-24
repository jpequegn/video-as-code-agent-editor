import { describe, expect, it } from "vitest";

import { createProgram } from "../src/cli.js";

describe("CLI", () => {
  it("exposes a stable name and version", () => {
    const program = createProgram();
    expect(program.name()).toBe("vace");
    expect(program.version()).toBe("0.1.0");
  });

  it("does not register media commands during bootstrap", () => {
    expect(createProgram().commands).toHaveLength(0);
  });
});
