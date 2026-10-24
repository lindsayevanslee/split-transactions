#!/usr/bin/env node

/**
 * Flags `overrides` in package.json that force a package to a version its
 * dependents did not ask for.
 *
 * npm applies overrides silently: an override that crosses a major line (e.g.
 * `"body-parser": "1.20.9"` after express moved to 5.x, which wants
 * `body-parser ^2`) shows up as "overridden" in `npm ls`, not invalid, and
 * `npm audit` stays clean. This script reads the lockfile, finds every
 * installed copy of each overridden package, and checks it against the range
 * declared by every package that depends on it.
 *
 * Usage: node check-override-ranges.js [--allow <name>]... <project-dir>...
 *
 * Each project dir must contain package.json and a lockfileVersion 2/3
 * package-lock.json. Exits 1 if any mismatch is found.
 *
 * --allow <name> accepts mismatches for that package, for an override that is
 * known to be out of range and kept on purpose. It fails if the allowed
 * package no longer has a mismatch anywhere, so the exception gets removed
 * once it is no longer needed.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import semver from "semver";

const DEP_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"];

/**
 * Collects the package names an `overrides` object targets. Handles both the
 * flat form (`"name": "1.2.3"`) and the nested form
 * (`"parent": { ".": "1.0.0", "child": "2.0.0" }`), where "." targets the
 * parent itself.
 */
export function overriddenNames(overrides = {}) {
  const names = new Set();
  for (const [key, value] of Object.entries(overrides)) {
    if (key === ".") continue;
    const name = packageNameFromSpec(key);
    if (typeof value === "string") {
      names.add(name);
    } else if (value && typeof value === "object") {
      if ("." in value) names.add(name);
      for (const child of overriddenNames(value)) names.add(child);
    }
  }
  return names;
}

// Override keys may carry a version selector, e.g. "foo@^1" or "@scope/foo@2".
function packageNameFromSpec(spec) {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
}

// "node_modules/a/node_modules/@s/b" -> "@s/b"
function nameFromPath(path) {
  const i = path.lastIndexOf("node_modules/");
  return path.slice(i + "node_modules/".length);
}

/**
 * Resolves which lockfile entry `fromPath` gets when it requires `name`,
 * following Node's lookup: its own node_modules, then each ancestor's, then
 * the project root's.
 */
function resolveDep(packages, fromPath, name) {
  let base = fromPath;
  for (;;) {
    const candidate = (base ? base + "/" : "") + "node_modules/" + name;
    if (packages[candidate]) return { path: candidate, entry: packages[candidate] };
    if (!base) return null;
    const i = base.lastIndexOf("node_modules/");
    base = i <= 0 ? "" : base.slice(0, i - 1);
  }
}

/**
 * Returns a list of mismatches: installed copies of overridden packages whose
 * version falls outside a dependent's declared range.
 */
export function findOverrideMismatches(packageJson, lockfile) {
  const names = overriddenNames(packageJson.overrides);
  const packages = lockfile.packages || {};
  const mismatches = [];
  if (names.size === 0) return mismatches;

  for (const [path, entry] of Object.entries(packages)) {
    for (const field of DEP_FIELDS) {
      for (const [name, range] of Object.entries(entry[field] || {})) {
        if (!names.has(name)) continue;
        // Skip non-semver specs (git URLs, file:, npm: aliases, tags).
        if (!semver.validRange(range)) continue;

        const resolved = resolveDep(packages, path, name);
        // Not installed: an unmet optional/peer dep or a platform-specific
        // optional dependency. Nothing was forced, so nothing to report.
        if (!resolved) continue;
        let { entry: target, path: targetPath } = resolved;
        if (target.link) {
          targetPath = target.resolved;
          target = packages[targetPath] || {};
        }
        if (!target.version) continue;

        if (!semver.satisfies(target.version, range, { includePrerelease: true })) {
          mismatches.push({
            name,
            installed: target.version,
            installedAt: targetPath,
            dependent: path === "" ? "(project root)" : nameFromPath(path),
            dependentVersion: entry.version,
            dependentPath: path,
            field,
            range,
          });
        }
      }
    }
  }
  return mismatches;
}

export function formatMismatch(m) {
  const who = m.dependentVersion ? `${m.dependent}@${m.dependentVersion}` : m.dependent;
  return `${m.name}@${m.installed} does not satisfy ${who} ${m.field} "${m.range}"`;
}

function checkProject(dir) {
  const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const lockfile = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
  if (!lockfile.packages) {
    throw new Error(`${dir}/package-lock.json has no "packages" map (lockfileVersion 2+ required)`);
  }
  return findOverrideMismatches(packageJson, lockfile);
}

export function parseArgs(argv) {
  const allow = new Set();
  const dirs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--allow") {
      if (!argv[i + 1]) throw new Error("--allow needs a package name");
      allow.add(argv[++i]);
    } else {
      dirs.push(argv[i]);
    }
  }
  return { allow, dirs };
}

function main(argv) {
  const { allow, dirs } = parseArgs(argv);
  if (dirs.length === 0) {
    console.error("Usage: node check-override-ranges.js [--allow <name>]... <project-dir>...");
    return 1;
  }
  let failed = false;
  let mismatched = false;
  const allowUsed = new Set();
  for (const dir of dirs) {
    const all = checkProject(dir);
    const allowed = all.filter((m) => allow.has(m.name));
    const mismatches = all.filter((m) => !allow.has(m.name));
    for (const m of allowed) {
      allowUsed.add(m.name);
      console.log(`${dir}: allowed by --allow ${m.name}: ${formatMismatch(m)}`);
    }
    if (mismatches.length === 0) {
      console.log(`${dir}: all other overrides satisfy their dependents' ranges.`);
      continue;
    }
    failed = mismatched = true;
    console.error(`${dir}: ${mismatches.length} override mismatch(es):`);
    for (const m of mismatches) console.error(`  - ${formatMismatch(m)}`);
  }
  for (const name of allow) {
    if (!allowUsed.has(name)) {
      failed = true;
      console.error(`--allow ${name} no longer matches any mismatch. Remove it.`);
    }
  }
  if (mismatched) {
    console.error(
      "\nAn override forces a version outside what a dependent declares (often a" +
        " different major line). Update or remove the override in package.json," +
        " or upgrade the dependent so the patched version is in its range."
    );
  }
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.exitCode = main(process.argv.slice(2));
}
