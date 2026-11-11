/**
 * Tests for reconcile-overrides.js.
 *
 * Regression coverage: the audit workflow bumped the `fast-xml-parser`
 * override from 5.7.0 to 5.12.0 (PR #71). fast-xml-parser 5.12.0 depends on
 * `fast-xml-builder ^1.3.1`, but the older `fast-xml-builder: 1.1.7` override
 * from an earlier run was left as is, so check-override-ranges.js failed in CI
 * with:
 *   fast-xml-builder@1.1.7 does not satisfy fast-xml-parser@5.12.0 dependencies "^1.3.1"
 *
 * The pure `reconcileOverrides` takes the registry's version list as a
 * function, so most tests run offline. The CLI tests stub `npm` on PATH the
 * same way add-audit-overrides.test.js does.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { reconcileOverrides, overrideKeyFor } from "./reconcile-overrides.js";
import { findOverrideMismatches } from "./check-override-ranges.js";

const SCRIPT = resolve(process.cwd(), ".github/scripts/reconcile-overrides.js");

/** Builds a lockfileVersion 3 object from { path: { version, dependencies, ... } }. */
const lock = (packages) => ({ lockfileVersion: 3, packages: { "": {}, ...packages } });

const FAST_XML_BUILDER_VERSIONS = ["1.1.5", "1.1.6", "1.1.7", "1.1.8", "1.2.0", "1.3.0", "1.3.1", "1.3.2"];

// functions/ after PR #71: fast-xml-parser bumped, fast-xml-builder stale.
const fastXmlAfterBump = () => ({
  pkg: {
    name: "functions",
    overrides: { "fast-xml-parser": "5.12.0", protobufjs: "7.6.5", "fast-xml-builder": "1.1.7" },
    dependencies: { "firebase-admin": "14.5.0" },
  },
  lockfile: lock({
    "node_modules/fast-xml-parser": {
      version: "5.12.0",
      dependencies: { "fast-xml-builder": "^1.3.1", strnum: "^2.5.1" },
    },
    "node_modules/fast-xml-builder": { version: "1.1.7" },
    "node_modules/strnum": { version: "2.5.1" },
    "node_modules/protobufjs": { version: "7.6.5" },
  }),
});

const versionsFor = (table) => (name) => table[name] ?? null;

describe("reconcileOverrides", () => {
  it("bumps a stale override to the lowest published version in the dependent's new range (PR #71)", () => {
    const { pkg, lockfile } = fastXmlAfterBump();
    const { overrides, bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ "fast-xml-builder": FAST_XML_BUILDER_VERSIONS }),
    });
    expect(bumped).toEqual([
      {
        name: "fast-xml-builder",
        from: "1.1.7",
        to: "1.3.1",
        dependents: ['fast-xml-parser@5.12.0 dependencies "^1.3.1"'],
      },
    ]);
    expect(unresolved).toEqual([]);
    expect(overrides).toEqual({
      "fast-xml-parser": "5.12.0",
      protobufjs: "7.6.5",
      "fast-xml-builder": "1.3.1",
    });
    // Does not mutate the input.
    expect(pkg.overrides["fast-xml-builder"]).toBe("1.1.7");
  });

  it("leaves the check clean once the lockfile picks up the bumped override", () => {
    const { pkg, lockfile } = fastXmlAfterBump();
    const { overrides } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ "fast-xml-builder": FAST_XML_BUILDER_VERSIONS }),
    });
    lockfile.packages["node_modules/fast-xml-builder"].version = overrides["fast-xml-builder"];
    expect(findOverrideMismatches({ ...pkg, overrides }, lockfile)).toEqual([]);
  });

  it("does nothing when every override is already in range", () => {
    const { pkg, lockfile } = fastXmlAfterBump();
    pkg.overrides["fast-xml-builder"] = "1.3.1";
    lockfile.packages["node_modules/fast-xml-builder"].version = "1.3.1";
    const result = reconcileOverrides(pkg, lockfile, {
      versionsFor: () => {
        throw new Error("registry must not be queried");
      },
    });
    expect(result).toEqual({ overrides: pkg.overrides, bumped: [], unresolved: [] });
  });

  it("picks a version that satisfies every dependent of the copy, not only the mismatched one", () => {
    const { pkg, lockfile } = fastXmlAfterBump();
    // A second dependent is satisfied today but excludes 1.3.1 and 1.3.2.
    lockfile.packages["node_modules/other"] = {
      version: "1.0.0",
      dependencies: { "fast-xml-builder": ">=1.1.0 <1.3.1 || >=1.3.3" },
    };
    const { bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ "fast-xml-builder": [...FAST_XML_BUILDER_VERSIONS, "1.3.3"] }),
    });
    expect(unresolved).toEqual([]);
    expect(bumped[0].to).toBe("1.3.3");
  });

  it("never crosses a major line: body-parser 1.x into express 5 is left for a human", () => {
    const pkg = { overrides: { "body-parser": "1.20.9" } };
    const lockfile = lock({
      "node_modules/express": { version: "5.3.0", dependencies: { "body-parser": "^2.3.0" } },
      "node_modules/body-parser": { version: "1.20.9" },
    });
    const { overrides, bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ "body-parser": ["1.20.9", "1.20.10", "2.3.0", "2.4.0"] }),
    });
    expect(bumped).toEqual([]);
    expect(overrides).toEqual({ "body-parser": "1.20.9" });
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({ name: "body-parser", installed: "1.20.9" });
    expect(unresolved[0].reason).toContain('no published version in ^1.20.9 satisfies "^2.3.0"');
    expect(unresolved[0].reason).toContain('express@5.3.0 dependencies "^2.3.0"');
  });

  it("treats 0.x minors as separate lines, like npm's caret", () => {
    const pkg = { overrides: { esbuild: "0.25.4" } };
    const lockfile = lock({
      "node_modules/vite": { version: "7.0.0", dependencies: { esbuild: "^0.28.0" } },
      "node_modules/esbuild": { version: "0.25.4" },
    });
    const { bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ esbuild: ["0.25.4", "0.25.5", "0.28.0"] }),
    });
    expect(bumped).toEqual([]);
    expect(unresolved[0].reason).toContain("^0.25.4");
  });

  it("never downgrades below the current override, since that would reintroduce the advisory", () => {
    const pkg = { overrides: { qs: "6.16.1" } };
    const lockfile = lock({
      "node_modules/old": { version: "1.0.0", dependencies: { qs: "~6.14.0" } },
      "node_modules/qs": { version: "6.16.1" },
    });
    const { bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ qs: ["6.14.0", "6.14.1", "6.16.1", "6.17.0"] }),
    });
    expect(bumped).toEqual([]);
    expect(unresolved).toHaveLength(1);
  });

  it("keeps a version-scoped key and only moves within its selector", () => {
    const pkg = { overrides: { "minimatch@^9": "9.0.7", "minimatch@^3": "3.1.2" } };
    const lockfile = lock({
      "node_modules/minimatch": { version: "9.0.7" },
      "node_modules/typescript-estree": { version: "8.0.0", dependencies: { minimatch: "^9.1.0" } },
      "node_modules/eslint": { version: "9.39.2", dependencies: { minimatch: "^3.1.2" } },
      "node_modules/eslint/node_modules/minimatch": { version: "3.1.2" },
    });
    const { overrides, bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ minimatch: ["3.1.2", "9.0.7", "9.1.0", "9.1.1", "10.0.0"] }),
    });
    expect(unresolved).toEqual([]);
    expect(bumped.map((b) => b.name)).toEqual(["minimatch@^9"]);
    expect(overrides).toEqual({ "minimatch@^9": "9.1.0", "minimatch@^3": "3.1.2" });
  });

  it("skips packages passed with --allow", () => {
    const pkg = { overrides: { "@grpc/grpc-js": "1.13.6" } };
    const lockfile = lock({
      "node_modules/@firebase/firestore": {
        version: "4.7.10",
        dependencies: { "@grpc/grpc-js": "~1.9.0" },
      },
      "node_modules/@grpc/grpc-js": { version: "1.13.6" },
    });
    const result = reconcileOverrides(pkg, lockfile, {
      allow: new Set(["@grpc/grpc-js"]),
      versionsFor: () => {
        throw new Error("registry must not be queried");
      },
    });
    expect(result).toEqual({ overrides: pkg.overrides, bumped: [], unresolved: [] });
  });

  it("reports a range override and a nested override instead of guessing", () => {
    const pkg = {
      overrides: { "fast-xml-builder": "^1.1.7", express: { ".": "5.3.0", qs: "6.14.0" } },
    };
    const lockfile = lock({
      "node_modules/fast-xml-parser": { version: "5.12.0", dependencies: { "fast-xml-builder": "^1.3.1" } },
      "node_modules/fast-xml-builder": { version: "1.1.7" },
      "node_modules/express": { version: "5.3.0", dependencies: { qs: "^6.16.0" } },
      "node_modules/qs": { version: "6.14.0" },
    });
    const { overrides, bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: versionsFor({ "fast-xml-builder": FAST_XML_BUILDER_VERSIONS, qs: ["6.14.0", "6.16.1"] }),
    });
    expect(bumped).toEqual([]);
    expect(overrides).toEqual(pkg.overrides);
    expect(unresolved.map((u) => u.name).sort()).toEqual(["fast-xml-builder", "qs"]);
    expect(unresolved.find((u) => u.name === "fast-xml-builder").reason).toMatch(/not an exact version/);
    expect(unresolved.find((u) => u.name === "qs").reason).toMatch(/nested override/);
  });

  it("reports a registry failure instead of changing anything", () => {
    const { pkg, lockfile } = fastXmlAfterBump();
    const { overrides, bumped, unresolved } = reconcileOverrides(pkg, lockfile, {
      versionsFor: () => null,
    });
    expect(bumped).toEqual([]);
    expect(overrides).toEqual(pkg.overrides);
    expect(unresolved[0].reason).toMatch(/could not list published versions of fast-xml-builder/);
  });
});

describe("overrideKeyFor", () => {
  it("prefers the flat key and otherwise matches the selector of a scoped key", () => {
    expect(overrideKeyFor({ minimatch: "9.0.7" }, "minimatch", "9.0.7")).toBe("minimatch");
    expect(overrideKeyFor({ "minimatch@^9": "9.0.7", "minimatch@^3": "3.1.2" }, "minimatch", "3.1.2")).toBe(
      "minimatch@^3"
    );
    expect(overrideKeyFor({ "minimatch@^9": "9.0.7" }, "minimatch", "3.1.2")).toBeNull();
    expect(overrideKeyFor({ "@scope/pkg@2": "2.0.1" }, "@scope/pkg", "2.0.1")).toBe("@scope/pkg@2");
    expect(overrideKeyFor({ express: { ".": "5.3.0" } }, "express", "5.3.0")).toBeNull();
  });
});

describe("reconcile-overrides CLI", () => {
  let workdir;
  let binDir;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), "reconcile-test-"));
    binDir = join(workdir, "bin");
    mkdirSync(binDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  /** Writes a project dir and a fake `npm` that answers `npm view <pkg> versions --json`. */
  function project({ pkg, lockfile }, publishedVersions, raw = null) {
    const dir = join(workdir, "functions");
    mkdirSync(dir);
    writeFileSync(join(dir, "package.json"), raw ?? JSON.stringify(pkg));
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lockfile));
    const npmPath = join(binDir, "npm");
    writeFileSync(
      npmPath,
      `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(JSON.stringify(publishedVersions))});\n`
    );
    chmodSync(npmPath, 0o755);
    return dir;
  }

  function cli(args) {
    try {
      const stdout = execFileSync("node", [SCRIPT, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
      });
      return { code: 0, stdout };
    } catch (err) {
      return { code: err.status, stdout: err.stdout, stderr: err.stderr };
    }
  }

  it("rewrites package.json and prints a JSON summary for the PR body", () => {
    const dir = project(fastXmlAfterBump(), FAST_XML_BUILDER_VERSIONS);
    const { code, stdout } = cli(["--allow", "@grpc/grpc-js", dir]);
    expect(code).toBe(0);
    const summary = JSON.parse(stdout);
    expect(summary.bumped).toEqual([
      {
        name: "fast-xml-builder",
        from: "1.1.7",
        to: "1.3.1",
        dependents: ['fast-xml-parser@5.12.0 dependencies "^1.3.1"'],
      },
    ]);
    expect(summary.unresolved).toEqual([]);
    const written = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(written.overrides["fast-xml-builder"]).toBe("1.3.1");
    expect(written.overrides["fast-xml-parser"]).toBe("5.12.0");
  });

  it("ignores prerelease versions from the registry", () => {
    const dir = project(fastXmlAfterBump(), ["1.1.7", "1.3.1-beta.1", "1.3.1"]);
    const { stdout } = cli([dir]);
    expect(JSON.parse(stdout).bumped[0].to).toBe("1.3.1");
  });

  it("leaves package.json byte-for-byte alone when nothing needs reconciling", () => {
    const fixture = fastXmlAfterBump();
    fixture.pkg.overrides["fast-xml-builder"] = "1.3.1";
    fixture.lockfile.packages["node_modules/fast-xml-builder"].version = "1.3.1";
    const raw = JSON.stringify(fixture.pkg, null, 4) + "\n"; // unusual formatting on purpose
    const dir = project(fixture, FAST_XML_BUILDER_VERSIONS, raw);
    const { code, stdout } = cli([dir]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ bumped: [], unresolved: [] });
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(raw);
  });

  it("exits 0 but reports an unresolved override, leaving the range check to fail", () => {
    const fixture = {
      pkg: { overrides: { "body-parser": "1.20.9" } },
      lockfile: lock({
        "node_modules/express": { version: "5.3.0", dependencies: { "body-parser": "^2.3.0" } },
        "node_modules/body-parser": { version: "1.20.9" },
      }),
    };
    const dir = project(fixture, ["1.20.9", "2.3.0"]);
    const { code, stdout } = cli([dir]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).unresolved[0].name).toBe("body-parser");
    expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).overrides["body-parser"]).toBe("1.20.9");
  });

  it("requires exactly one project dir", () => {
    expect(cli([]).code).toBe(1);
    expect(cli(["a", "b"]).code).toBe(1);
  });
});
