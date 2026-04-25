import { describe, expect, it } from "vitest";
import { parseVerifyArgs } from "./args.js";

describe("parseVerifyArgs", () => {
  it("parses verify files, format, and fail-on severity", () => {
    expect(
      parseVerifyArgs(["verify", "src/App.tsx", "--json", "--fail-on", "warning"]),
    ).toEqual({
      files: ["src/App.tsx"],
      format: "json",
      failOn: "warning",
    });
  });

  it("rejects invalid fail-on severities", () => {
    expect(() => parseVerifyArgs(["--fail-on", "critical"])).toThrow(
      "Invalid --fail-on severity",
    );
  });
});
