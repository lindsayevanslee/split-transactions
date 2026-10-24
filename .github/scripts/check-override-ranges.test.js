/**
 * Tests for check-override-ranges.js.
 *
 * Regression coverage: firebase-functions 7.3.2 moved from express 4 to
 * express 5, and an audit-added override `"body-parser": "1.20.9"` (express 4's
 * line) would have silently forced body-parser 1.x into express 5, which
 * requires ^2.3.0. `npm ls` showed it as "overridden" and `npm audit` stayed
 * clean. See PR #69.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  findOverrideMismatches,
  overriddenNames,
  formatMismatch,
  parseArgs,
} from "./check-override-ranges.js";

// Resolve relative to the repo root (vitest runs from there), like
// add-audit-overrides.test.js.
const SCRIPT = resolve(process.cwd(), ".github/scripts/check-override-ranges.js");

/** Builds a lockfileVersion 3 object from { path: { version, dependencies, ... } }. */
const lock = (packages) => ({ lockfileVersion: 3, packages: { "": {}, ...packages } });

// The tree from the firebase-functions 7.4.0 upgrade, with the stale override.
const express5WithBodyParser1 = () => ({
  pkg: {
    name: "functions",
    overrides: { "body-parser": "1.20.9" },
    dependencies: { "firebase-functions": "7.4.0" },
  },
  lockfile: lock({
    "": { dependencies: { "firebase-functions": "7.4.0" } },
    "node_modules/firebase-functions": {
      version: "7.4.0",
      dependencies: { express: "^5.2.1" },
    },
    "node_modules/express": {
      version: "5.3.0",
      dependencies: { "body-parser": "^2.3.0", qs: "^6.16.0" },
    },
    "node_modules/body-parser": {
      version: "1.20.9",
      dependencies: { qs: "~6.16.0" },
    },
    "node_modules/qs": { version: "6.16.1" },
  }),
});

describe("findOverrideMismatches", () => {
  it("flags body-parser 1.20.9 forced into express 5 (^2.3.0)", () => {
    const { pkg, lockfile } = express5WithBodyParser1();
    const mismatches = findOverrideMismatches(pkg, lockfile);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      name: "body-parser",
      installed: "1.20.9",
      dependent: "express",
      dependentVersion: "5.3.0",
      field: "dependencies",
      range: "^2.3.0",
    });
    expect(formatMismatch(mismatches[0])).toBe(
      'body-parser@1.20.9 does not satisfy express@5.3.0 dependencies "^2.3.0"'
    );
  });

  it("passes once the override is removed and express 5 gets body-parser 2.x", () => {
    const { pkg, lockfile } = express5WithBodyParser1();
    delete pkg.overrides["body-parser"];
    lockfile.packages["node_modules/body-parser"].version = "2.4.0";
    expect(findOverrideMismatches(pkg, lockfile)).toEqual([]);
  });

  it("passes when the override is inside every dependent's range (express 4 era)", () => {
    const pkg = { overrides: { "body-parser": "1.20.9" } };
    const lockfile = lock({
      "node_modules/express": { version: "4.22.3", dependencies: { "body-parser": "~1.20.3" } },
      "node_modules/body-parser": { version: "1.20.9" },
    });
    expect(findOverrideMismatches(pkg, lockfile)).toEqual([]);
  });

  it("only checks overridden packages", () => {
    // qs is out of a's range, but npm only forces versions for overrides, so
    // a plain range conflict is npm ls's job, not this check's.
    const pkg = { overrides: {} };
    const lockfile = lock({
      "node_modules/a": { version: "1.0.0", dependencies: { qs: "^5.0.0" } },
      "node_modules/qs": { version: "6.16.1" },
    });
    expect(findOverrideMismatches(pkg, lockfile)).toEqual([]);
  });

  it("checks each dependent against the copy it actually resolves to (nested node_modules)", () => {
    // eslint has its own nested minimatch 3.x; typescript-estree uses the
    // hoisted 9.x. Only the nested copy is out of range.
    const pkg = { overrides: { minimatch: "9.0.7" } };
    const lockfile = lock({
      "node_modules/minimatch": { version: "9.0.7" },
      "node_modules/typescript-estree": {
        version: "8.0.0",
        dependencies: { minimatch: "^9.0.4" },
      },
      "node_modules/eslint": { version: "9.39.2", dependencies: { minimatch: "^3.1.2" } },
      "node_modules/eslint/node_modules/minimatch": { version: "9.0.7" },
    });
    const mismatches = findOverrideMismatches(pkg, lockfile);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      dependent: "eslint",
      installedAt: "node_modules/eslint/node_modules/minimatch",
      range: "^3.1.2",
    });
  });

  it("resolves through ancestors' node_modules and handles scoped names", () => {
    const pkg = { overrides: { "@grpc/grpc-js": "1.13.6" } };
    const lockfile = lock({
      "node_modules/@firebase/firestore": {
        version: "4.7.10",
        dependencies: { "@grpc/grpc-js": "~1.9.0" },
      },
      "node_modules/@firebase/firestore/node_modules/inner": {
        version: "1.0.0",
        dependencies: { "@grpc/grpc-js": "^1.13.0" },
      },
      "node_modules/@grpc/grpc-js": { version: "1.13.6" },
    });
    const mismatches = findOverrideMismatches(pkg, lockfile);
    // "inner" resolves up to the root copy and is satisfied; firestore is not.
    expect(mismatches.map((m) => m.dependent)).toEqual(["@firebase/firestore"]);
  });

  it("checks optionalDependencies and peerDependencies too", () => {
    const pkg = { overrides: { react: "19.1.0" } };
    const lockfile = lock({
      "node_modules/react": { version: "19.1.0" },
      "node_modules/lib-a": { version: "1.0.0", peerDependencies: { react: "^18.0.0" } },
      "node_modules/lib-b": { version: "1.0.0", optionalDependencies: { react: "^17.0.0" } },
    });
    const mismatches = findOverrideMismatches(pkg, lockfile);
    expect(mismatches.map((m) => [m.dependent, m.field])).toEqual([
      ["lib-a", "peerDependencies"],
      ["lib-b", "optionalDependencies"],
    ]);
  });

  it("skips dependencies that are not installed (unmet optional peers, other platforms)", () => {
    const pkg = { overrides: { graphql: "16.12.0" } };
    const lockfile = lock({
      "node_modules/firebase-functions": {
        version: "7.4.0",
        peerDependencies: { graphql: "^16.12.0" },
      },
    });
    expect(findOverrideMismatches(pkg, lockfile)).toEqual([]);
  });

  it("skips non-semver specs (aliases, git, file)", () => {
    const pkg = { overrides: { foo: "2.0.0" } };
    const lockfile = lock({
      "node_modules/foo": { version: "2.0.0" },
      "node_modules/a": { version: "1.0.0", dependencies: { foo: "npm:bar@^1.0.0" } },
      "node_modules/b": { version: "1.0.0", dependencies: { foo: "github:x/foo" } },
      "node_modules/c": { version: "1.0.0", dependencies: { foo: "file:../foo" } },
    });
    expect(findOverrideMismatches(pkg, lockfile)).toEqual([]);
  });

  it("follows workspace links to the linked package's version", () => {
    const pkg = { overrides: { shared: "2.0.0" } };
    const lockfile = lock({
      "node_modules/shared": { resolved: "packages/shared", link: true },
      "packages/shared": { version: "2.0.0" },
      "node_modules/app": { version: "1.0.0", dependencies: { shared: "^1.0.0" } },
    });
    const mismatches = findOverrideMismatches(pkg, lockfile);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ installed: "2.0.0", installedAt: "packages/shared" });
  });
});

describe("overriddenNames", () => {
  it("handles flat, version-scoped and nested overrides", () => {
    const names = overriddenNames({
      "body-parser": "1.20.9",
      "minimatch@^9": "9.0.7",
      "@scope/pkg@2": "2.0.1",
      express: { ".": "5.3.0", qs: "6.16.1" },
      parent: { child: "1.0.0" },
    });
    expect([...names].sort()).toEqual(
      ["@scope/pkg", "body-parser", "child", "express", "minimatch", "qs"].sort()
    );
  });

  it("returns nothing when there are no overrides", () => {
    expect(overriddenNames(undefined).size).toBe(0);
  });
});

describe("parseArgs", () => {
  it("collects --allow names and project dirs", () => {
    const { allow, dirs } = parseArgs(["--allow", "@grpc/grpc-js", ".", "functions"]);
    expect([...allow]).toEqual(["@grpc/grpc-js"]);
    expect(dirs).toEqual([".", "functions"]);
  });

  it("rejects --allow without a name", () => {
    expect(() => parseArgs([".", "--allow"])).toThrow(/needs a package name/);
  });
});

describe("check-override-ranges CLI", () => {
  let workdir;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), "override-ranges-test-"));
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  function project(name, { pkg, lockfile }) {
    const dir = join(workdir, name);
    mkdirSync(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lockfile));
    return dir;
  }

  /** Runs the CLI and returns { code, output } (stdout + stderr). */
  function cli(args) {
    try {
      const out = execFileSync("node", [SCRIPT, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, output: out };
    } catch (err) {
      return { code: err.status, output: `${err.stdout}${err.stderr}` };
    }
  }

  const clean = () => ({
    pkg: { overrides: { qs: "6.16.1" } },
    lockfile: lock({
      "node_modules/express": { version: "5.3.0", dependencies: { qs: "^6.16.0" } },
      "node_modules/qs": { version: "6.16.1" },
    }),
  });

  it("exits 1 and names the mismatch for the body-parser/express 5 case", () => {
    const dir = project("functions", express5WithBodyParser1());
    const { code, output } = cli([dir]);
    expect(code).toBe(1);
    expect(output).toContain('body-parser@1.20.9 does not satisfy express@5.3.0 dependencies "^2.3.0"');
  });

  it("exits 0 when every project is clean", () => {
    const a = project("a", clean());
    const b = project("b", clean());
    const { code, output } = cli([a, b]);
    expect(code).toBe(0);
    expect(output).toMatch(/all other overrides satisfy/);
  });

  it("fails if any one of several projects has a mismatch", () => {
    const a = project("a", clean());
    const b = project("b", express5WithBodyParser1());
    expect(cli([a, b]).code).toBe(1);
  });

  it("--allow accepts a known mismatch and still reports it", () => {
    const dir = project("functions", express5WithBodyParser1());
    const { code, output } = cli(["--allow", "body-parser", dir]);
    expect(code).toBe(0);
    expect(output).toMatch(/allowed by --allow body-parser/);
  });

  it("--allow does not hide mismatches in other packages", () => {
    const dir = project("functions", express5WithBodyParser1());
    expect(cli(["--allow", "qs", dir]).code).toBe(1);
  });

  it("fails when an --allow entry no longer matches anything, so it gets removed", () => {
    const dir = project("a", clean());
    const { code, output } = cli(["--allow", "body-parser", dir]);
    expect(code).toBe(1);
    expect(output).toMatch(/--allow body-parser no longer matches any mismatch/);
  });

  it("errors on an old lockfile without a packages map", () => {
    const dir = project("old", { pkg: { overrides: {} }, lockfile: { lockfileVersion: 1 } });
    const { code, output } = cli([dir]);
    expect(code).not.toBe(0);
    expect(output).toMatch(/lockfileVersion 2\+ required/);
  });
});

describe("ci.yml", () => {
  // The check only helps if CI runs it, on both projects.
  const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const runLine = ci
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("run: node .github/scripts/check-override-ranges.js"));

  it("runs the override range check", () => {
    expect(runLine).toBeDefined();
  });

  it("checks both the root project and functions/", () => {
    const args = runLine.replace("run: node .github/scripts/check-override-ranges.js", "");
    const { dirs } = parseArgs(args.trim().split(/\s+/));
    expect(dirs.sort()).toEqual([".", "functions"]);
  });
});
