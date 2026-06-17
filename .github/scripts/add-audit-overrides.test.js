/**
 * Tests for add-audit-overrides.js.
 *
 * The script resolves a derived "fix version" against the npm registry. To keep
 * these tests deterministic and offline, we put a fake `npm` executable on PATH
 * that returns a canned `versions` list. This exercises the real script
 * end-to-end (CLI args, file I/O, registry resolution) without network access.
 *
 * Regression coverage: a `<=7.29.0` advisory on @babel/core used to derive the
 * nonexistent version 7.29.1, which made the workflow's `npm install` abort with
 * ETARGET. See git history around 2026-06-16.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

// Resolve relative to the repo root (vitest runs from there) rather than
// import.meta.url, which is not a usable file URL under the vitest transform.
const SCRIPT = resolve(process.cwd(), ".github/scripts/add-audit-overrides.js");

let workdir;
let binDir;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "audit-test-"));
  binDir = join(workdir, "bin");
  mkdirSync(binDir, { recursive: true });
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

/** Runs the script with a stubbed `npm` on PATH and returns {summary, pkg}. */
function run(auditObj, pkgObj, publishedVersions) {
  const auditFile = join(workdir, "audit.json");
  const pkgFile = join(workdir, "package.json");
  writeFileSync(auditFile, JSON.stringify(auditObj));
  writeFileSync(pkgFile, JSON.stringify(pkgObj));

  // Fake npm: respond to `npm view <pkg> versions --json` with the canned list.
  const npmPath = join(binDir, "npm");
  writeFileSync(
    npmPath,
    `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(
      JSON.stringify(publishedVersions)
    )});\n`
  );
  chmodSync(npmPath, 0o755);

  const stdout = execFileSync("node", [SCRIPT, auditFile, pkgFile], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
  });
  return {
    summary: JSON.parse(stdout),
    pkg: JSON.parse(readFileSync(pkgFile, "utf8")),
  };
}

const advisory = (range) => ({
  via: [{ source: 1, name: "@babel/core", range, url: "https://example/x" }],
  name: "@babel/core",
  severity: "low",
  isDirect: false,
  fixAvailable: true,
});

const basePkg = () => ({ name: "f", version: "1.0.0", overrides: {} });

describe("add-audit-overrides registry resolution", () => {
  it("resolves a nonexistent derived version (7.29.1 from <=7.29.0) to the lowest real published version", () => {
    const audit = { vulnerabilities: { "@babel/core": advisory("<=7.29.0") } };
    const { summary, pkg } = run(audit, basePkg(), [
      "7.28.0",
      "7.29.0",
      "7.29.6",
      "7.29.7",
      "8.0.0",
    ]);
    expect(pkg.overrides["@babel/core"]).toBe("7.29.6");
    expect(summary.added).toHaveLength(1);
    expect(summary.added[0].version).toBe("7.29.6");
  });

  it("skips (does not write) when no published version satisfies the candidate", () => {
    const audit = { vulnerabilities: { "@babel/core": advisory("<=999.0.0") } };
    const { summary, pkg } = run(audit, basePkg(), ["7.29.6", "8.0.0"]);
    expect(pkg.overrides["@babel/core"]).toBeUndefined();
    expect(summary.skipped).toHaveLength(1);
    expect(summary.skipped[0].reason).toMatch(/No published version/);
  });

  it("uses the exact derived version when it is itself published (<X.Y.Z form)", () => {
    const audit = { vulnerabilities: { "@babel/core": advisory("<7.29.6") } };
    const { pkg } = run(audit, basePkg(), ["7.29.0", "7.29.6", "8.0.0"]);
    expect(pkg.overrides["@babel/core"]).toBe("7.29.6");
  });

  it("ignores prerelease versions when resolving", () => {
    const audit = { vulnerabilities: { "@babel/core": advisory("<=7.29.0") } };
    const { pkg } = run(audit, basePkg(), ["7.29.0", "7.29.1-beta.1", "7.29.6"]);
    // 7.29.1-beta.1 clears the boundary numerically but is a prerelease → skipped
    expect(pkg.overrides["@babel/core"]).toBe("7.29.6");
  });
});
