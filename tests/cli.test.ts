import { describe, expect, it } from "vitest";

import { createProgram, formatCliOutput, verdictExitCode } from "../src/cli.js";

describe("CLI", () => {
  it("exposes a stable name and version", () => {
    const program = createProgram();
    expect(program.name()).toBe("vace");
    expect(program.version()).toBe("0.1.0");
  });

  it("registers the complete stage and pipeline command set", () => {
    expect(createProgram().commands.map((command) => command.name())).toEqual([
      "ingest",
      "plan",
      "approve",
      "compile",
      "render",
      "qa",
      "evaluate",
      "review",
      "run",
      "demo"
    ]);
  });

  it("formats machine-readable and concise output", () => {
    const result = {
      status: "complete",
      packet: { verdict: "approve" },
      markdownPath: "/tmp/review.md"
    };
    expect(JSON.parse(formatCliOutput(result, "json"))).toEqual(result);
    expect(formatCliOutput(result, "status")).toBe(
      "complete verdict=approve review=/tmp/review.md\n"
    );
  });

  it("maps review verdicts to stable exit codes", () => {
    expect(verdictExitCode("approve")).toBe(0);
    expect(verdictExitCode("reject")).toBe(2);
    expect(verdictExitCode("review")).toBe(3);
  });
});
