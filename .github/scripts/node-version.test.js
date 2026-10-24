/**
 * Keeps every workflow on the same Node major as the Cloud Functions runtime
 * (functions/package.json "engines.node").
 *
 * Node and npm ship together, so one Node version means one npm version: the
 * lockfiles the security audit writes are then installed by the same npm in
 * CI and deploys, and CI tests on the Node that production runs. A mismatch
 * here once left the audit regenerating lockfiles with an npm that crashed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const WORKFLOWS_DIR = resolve(process.cwd(), ".github/workflows");
const FUNCTIONS_NODE = JSON.parse(
  readFileSync(resolve(process.cwd(), "functions/package.json"), "utf8")
).engines.node;

const workflows = readdirSync(WORKFLOWS_DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({
    file: f,
    text: readFileSync(resolve(WORKFLOWS_DIR, f), "utf8"),
  }));

/** The values of every `node-version:` input in a workflow. */
function nodeVersions(text) {
  return [...text.matchAll(/^\s*node-version:\s*['"]?([^'"\s#]+)/gm)].map(
    (m) => m[1]
  );
}

describe("Node version", () => {
  it("pins the functions runtime to a single major version", () => {
    expect(FUNCTIONS_NODE).toMatch(/^\d+$/);
  });

  it("matches the functions runtime in every workflow that sets up Node", () => {
    const usesNode = workflows.filter((w) => w.text.includes("actions/setup-node@"));
    expect(usesNode.length).toBeGreaterThanOrEqual(4);
    for (const w of usesNode) {
      const versions = nodeVersions(w.text);
      expect(versions.length, `${w.file} sets no node-version`).toBeGreaterThan(0);
      for (const v of versions) {
        expect(v, `${w.file} node-version`).toBe(FUNCTIONS_NODE);
      }
    }
  });
});
