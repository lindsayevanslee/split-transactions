/**
 * Tests for signature-summary.js, which fills the "Package provenance
 * verification" lines of the security audit PR description.
 *
 * Regression coverage: the workflow used to take the last line of
 * `npm audit signatures` output. npm 11 ends that output with a
 * "(use --json --include-attestations ...)" hint, so PR #67 showed the hint
 * instead of the signature counts.
 */
import { describe, it, expect } from "vitest";
import { signatureSummary } from "./signature-summary.js";

// Captured from security audit run 40123391158 (npm 11.19).
const NPM11_OK = `audited 246 packages in 2s

246 packages have verified registry signatures

8 packages have verified attestations
(use --json --include-attestations to view attestation details)
`;

// Captured from security audit run 40105282269 (npm 10.9).
const NPM10_OK = `audited 404 packages in 11s

404 packages have verified registry signatures

78 packages have verified attestations
`;

// Wording from npm's lib/utils/verify-signatures.js.
const INVALID = `audited 404 packages in 11s

403 packages have verified registry signatures

1 package has an invalid registry signature:

evil@1.0.0 (https://registry.npmjs.org/)

Someone might have tampered with this package since it was published on the registry!
`;

const MISSING = `audited 2 packages in 1s

2 packages have missing registry signatures but the registry is providing signing keys:

a@1.0.0 (https://registry.npmjs.org/)
b@1.0.0 (https://registry.npmjs.org/)
`;

describe("signatureSummary", () => {
  it("ignores the trailing hint npm 11 prints", () => {
    expect(signatureSummary(NPM11_OK)).toBe(
      "246 packages have verified registry signatures; 8 packages have verified attestations"
    );
  });

  it("summarises npm 10 output the same way", () => {
    expect(signatureSummary(NPM10_OK)).toBe(
      "404 packages have verified registry signatures; 78 packages have verified attestations"
    );
  });

  it("includes invalid signatures", () => {
    expect(signatureSummary(INVALID)).toBe(
      "403 packages have verified registry signatures; 1 package has an invalid registry signature"
    );
  });

  it("includes missing signatures", () => {
    expect(signatureSummary(MISSING)).toBe(
      "2 packages have missing registry signatures but the registry is providing signing keys"
    );
  });

  it("strips terminal colours", () => {
    expect(signatureSummary("5 packages have \x1b[1mverified\x1b[22m registry signatures\n")).toBe(
      "5 packages have verified registry signatures"
    );
  });

  it("falls back to the error when npm could not check at all", () => {
    expect(
      signatureSummary("npm error Failed to download\nnpm error A complete log of this run can be found in: /x.log\n")
    ).toBe("npm error Failed to download");
  });

  it("handles empty output", () => {
    expect(signatureSummary("")).toBe("(no output)");
  });
});
