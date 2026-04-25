import { describe, expect, it } from "vitest";
import { loadFixture } from "../../test/golden.js";
import { analyzeProject } from "./index.js";

describe("analyzeProject", () => {
  it("matches the deprecated fixture", async () => {
    const fixture = await loadFixture("react-18-deprecated");
    const result = await analyzeProject({ root: fixture.root });
    expect(result.findings.map((finding) => finding.longId)).toEqual(
      fixture.expectedFindings.map((finding) => finding.longId),
    );
    expect(result.findings.map((finding) => finding.kind)).toEqual(
      fixture.expectedFindings.map((finding) => finding.kind),
    );
  });

  it("matches the removed fixture including non-call member access", async () => {
    const fixture = await loadFixture("react-19-removed");
    const result = await analyzeProject({ root: fixture.root });
    expect(result.findings.map((finding) => finding.longId)).toEqual(
      fixture.expectedFindings.map((finding) => finding.longId),
    );
    expect(result.findings.map((finding) => finding.kind)).toEqual(
      fixture.expectedFindings.map((finding) => finding.kind),
    );
  });

  it("matches the future API fixture", async () => {
    const fixture = await loadFixture("react-future-api");
    const result = await analyzeProject({ root: fixture.root });
    expect(result.findings.map((finding) => finding.longId)).toEqual(
      fixture.expectedFindings.map((finding) => finding.longId),
    );
    expect(result.findings.map((finding) => finding.kind)).toEqual(
      fixture.expectedFindings.map((finding) => finding.kind),
    );
  });

  it("matches the wrong arity fixture", async () => {
    const fixture = await loadFixture("react-18-wrong-arity");
    const result = await analyzeProject({ root: fixture.root });
    expect(result.findings.map((finding) => finding.longId)).toEqual(
      fixture.expectedFindings.map((finding) => finding.longId),
    );
    expect(result.findings.map((finding) => finding.kind)).toEqual(
      fixture.expectedFindings.map((finding) => finding.kind),
    );
  });

  it("applies inline suppressions", async () => {
    const fixture = await loadFixture("suppression-inline");
    const result = await analyzeProject({ root: fixture.root });
    expect(result.findings.map((finding) => finding.longId)).toEqual(
      fixture.expectedFindings.map((finding) => finding.longId),
    );
  });

  it("applies config suppressions", async () => {
    const fixture = await loadFixture("suppression-config");
    const result = await analyzeProject({ root: fixture.root });
    expect(result.findings.map((finding) => finding.longId)).toEqual(
      fixture.expectedFindings.map((finding) => finding.longId),
    );
  });
});
