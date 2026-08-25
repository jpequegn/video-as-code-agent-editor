import { describe, expect, it } from "vitest";

import { resolveBrowserOptions } from "../src/render/adapters.js";

describe("resolveBrowserOptions", () => {
  it("uses the full Chrome mode for an explicit browser executable", () => {
    expect(
      resolveBrowserOptions("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ).toEqual({
      browserExecutable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      chromeMode: "chrome-for-testing"
    });
  });

  it("lets Remotion provision its default headless shell", () => {
    expect(resolveBrowserOptions(undefined)).toEqual({ browserExecutable: null });
  });
});
