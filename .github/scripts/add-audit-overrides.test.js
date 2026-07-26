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

describe("add-audit-overrides major-version cap", () => {
  // Mirrors the real react-router case: five bundled advisories, four fixed in
  // 7.18.0 and one (an RSC-mode CSRF) only fixed in 8.3.0. The project is on
  // react-router 7.x via an existing override, so the fix must stay in v7.
  const reactRouterAudit = () => ({
    vulnerabilities: {
      "react-router": {
        name: "react-router",
        severity: "high",
        isDirect: false,
        fixAvailable: { name: "react-router-dom", version: "7.18.1", isSemVerMajor: false },
        via: [
          { name: "react-router", range: ">=6.0.0 <7.18.0", url: "https://ex/open-redirect" },
          { name: "react-router", range: ">=7.11.0 <7.18.0", url: "https://ex/xss" },
          { name: "react-router", range: ">=7.0.0 <7.18.0", url: "https://ex/dos" },
          { name: "react-router", range: ">=7.12.0 <8.3.0", url: "https://ex/rsc-csrf" },
        ],
      },
    },
  });
  const pkgOnV7 = () => ({
    name: "f",
    version: "1.0.0",
    dependencies: { "react-router-dom": "7.12.0" },
    overrides: { "react-router": "7.15.1" },
  });
  const publishedRR = ["7.15.1", "7.18.0", "7.18.1", "8.0.0", "8.3.0"];

  it("applies the highest in-major fix and never crosses to the next major", () => {
    const { pkg, summary } = run(reactRouterAudit(), pkgOnV7(), publishedRR);
    // Stays on v7 (7.18.0), does NOT jump to 8.3.0 even though an advisory wants it.
    expect(pkg.overrides["react-router"]).toBe("7.18.0");
    expect(summary.added.map((a) => a.version)).toEqual(["7.18.0"]);
  });

  it("flags the major-only advisory for human review instead of auto-applying it", () => {
    const { summary } = run(reactRouterAudit(), pkgOnV7(), publishedRR);
    const majorSkip = summary.skipped.find((s) => /major-version upgrade/i.test(s.reason));
    expect(majorSkip).toBeDefined();
    expect(majorSkip.reason).toMatch(/8\.3\.0/);
    expect(majorSkip.url).toBe("https://ex/rsc-csrf");
  });

  it("applies nothing when every advisory requires a major bump (all blocked)", () => {
    const audit = {
      vulnerabilities: {
        "react-router": {
          name: "react-router",
          severity: "high",
          isDirect: false,
          fixAvailable: { name: "react-router", version: "8.3.0", isSemVerMajor: true },
          via: [{ name: "react-router", range: ">=7.12.0 <8.3.0", url: "https://ex/rsc-csrf" }],
        },
      },
    };
    const { pkg, summary } = run(audit, pkgOnV7(), publishedRR);
    expect(pkg.overrides["react-router"]).toBe("7.15.1"); // unchanged
    expect(summary.added).toHaveLength(0);
    expect(summary.skipped.some((s) => /major-version upgrade/i.test(s.reason))).toBe(true);
  });

  it("derives the stay-here major from npm's non-major fixAvailable when no override exists yet", () => {
    const audit = reactRouterAudit();
    const pkg = { name: "f", version: "1.0.0", dependencies: {}, overrides: {} };
    const { pkg: out } = run(audit, pkg, publishedRR);
    // fixAvailable.version 7.18.1 (isSemVerMajor:false) anchors the cap at v7.
    expect(out.overrides["react-router"]).toBe("7.18.0");
  });
});
