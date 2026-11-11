#!/usr/bin/env node

/**
 * Reconciles `overrides` in package.json with the ranges their dependents
 * declare, after the security audit has bumped overrides.
 *
 * Bumping one override can move another one out of range: PR #71 raised the
 * `fast-xml-parser` override from 5.7.0 to 5.12.0, which depends on
 * `fast-xml-builder ^1.3.1`, while the older `fast-xml-builder: 1.1.7`
 * override stayed behind, so check-override-ranges.js failed in CI.
 *
 * For each overridden package that no longer satisfies a dependent, this
 * script bumps the override to the lowest published version that
 *   - is >= the current override, so the advisory it was added for stays
 *     fixed, and on the same caret line (^current), so a major (or 0.x minor)
 *     line is never crossed automatically, matching add-audit-overrides.js;
 *   - satisfies every dependent of that copy, not just the mismatched ones,
 *     so the bump does not create a new mismatch;
 *   - for a scoped key such as "minimatch@^9", still matches the selector.
 * Anything else (a different major line, a range override, a nested override)
 * is reported for a human; check-override-ranges.js then fails on it.
 *
 * Usage: node reconcile-overrides.js [--allow <name>]... <project-dir>
 *
 * --allow <name> skips that package, for a mismatch kept on purpose (the same
 * flag check-override-ranges.js takes). Writes package.json in place when
 * something changed and prints a JSON summary to stdout:
 *   { bumped: [{ name, from, to, dependents }], unresolved: [{ name, installed, reason }] }
 */

import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { pathToFileURL } from "url";
import semver from "semver";
import { overrideDependents, parseArgs, parseOverrideKey } from "./check-override-ranges.js";

/**
 * Finds the override key that pins `installed` for `name`: the flat key
 * "name", or a scoped key "name@<selector>" whose selector the installed
 * version matches. Returns null for nested (object) overrides.
 */
export function overrideKeyFor(overrides = {}, name, installed) {
  for (const key of Object.keys(overrides)) {
    const [keyName, selector] = parseOverrideKey(key);
    if (keyName !== name || typeof overrides[key] !== "string") continue;
    if (selector === null) return key;
    if (semver.validRange(selector) && semver.satisfies(installed, selector)) return key;
  }
  return null;
}

/** Published stable versions of a package, lowest first, or null on failure. */
export function publishedVersions(name) {
  try {
    // execFileSync (not exec) avoids shell injection from the name.
    const out = execFileSync("npm", ["view", name, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(out);
    const versions = Array.isArray(parsed) ? parsed : [parsed];
    return versions.filter((v) => semver.valid(v) && !semver.prerelease(v)).sort(semver.compare);
  } catch {
    return null;
  }
}

const describeDependent = (e) =>
  `${e.dependent}${e.dependentVersion ? "@" + e.dependentVersion : ""} ${e.field} "${e.range}"`;

/**
 * Computes the override changes for one project. Pure: `versionsFor(name)`
 * supplies the registry's published versions so tests can run offline.
 * Returns { overrides, bumped, unresolved } with a new overrides object.
 */
export function reconcileOverrides(packageJson, lockfile, { allow = new Set(), versionsFor } = {}) {
  const overrides = { ...(packageJson.overrides || {}) };
  const bumped = [];
  const unresolved = [];

  // Group every dependent edge by the override key that governs the copy it
  // resolves to; only keys with at least one mismatch need work.
  const groups = new Map();
  for (const edge of overrideDependents(packageJson, lockfile)) {
    if (allow.has(edge.name)) continue;
    const key = overrideKeyFor(overrides, edge.name, edge.installed);
    if (key === null) {
      if (!edge.satisfied) {
        unresolved.push({
          name: edge.name,
          installed: edge.installed,
          reason: `no flat override pins this copy (nested override?); ${describeDependent(edge)} is not satisfied`,
        });
      }
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(edge);
  }

  for (const [key, edges] of groups) {
    const mismatched = edges.filter((e) => !e.satisfied);
    if (mismatched.length === 0) continue;
    const [name, selector] = parseOverrideKey(key);
    const current = overrides[key];
    const needs = mismatched.map(describeDependent);

    if (!semver.valid(current)) {
      unresolved.push({
        name: key,
        installed: current,
        reason: `override "${current}" is not an exact version; ${needs.join("; ")}`,
      });
      continue;
    }

    const versions = versionsFor(name);
    if (!versions) {
      unresolved.push({ name: key, installed: current, reason: `could not list published versions of ${name}` });
      continue;
    }

    const line = `^${current}`;
    const target = versions.find(
      (v) =>
        semver.satisfies(v, line) &&
        (selector === null || semver.satisfies(v, selector)) &&
        edges.every((e) => semver.satisfies(v, e.range, { includePrerelease: true }))
    );
    if (!target) {
      unresolved.push({
        name: key,
        installed: current,
        reason:
          `no published version in ${line} satisfies ${[...new Set(edges.map((e) => `"${e.range}"`))].join(" and ")}` +
          ` (${needs.join("; ")}); the fix needs a different major line or dropping the override, so review by hand`,
      });
      continue;
    }

    overrides[key] = target;
    bumped.push({ name: key, from: current, to: target, dependents: needs });
  }

  return { overrides, bumped, unresolved };
}

function main(argv) {
  const { allow, dirs } = parseArgs(argv);
  if (dirs.length !== 1) {
    console.error("Usage: node reconcile-overrides.js [--allow <name>]... <project-dir>");
    return 1;
  }
  const [dir] = dirs;
  const packageFile = join(dir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  const lockfile = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
  if (!lockfile.packages) {
    throw new Error(`${dir}/package-lock.json has no "packages" map (lockfileVersion 2+ required)`);
  }

  const { overrides, bumped, unresolved } = reconcileOverrides(packageJson, lockfile, {
    allow,
    versionsFor: publishedVersions,
  });

  if (bumped.length > 0) {
    packageJson.overrides = overrides;
    writeFileSync(packageFile, JSON.stringify(packageJson, null, 2) + "\n");
  }
  for (const b of bumped) {
    console.error(`${dir}: bumped override ${b.name} ${b.from} -> ${b.to} for ${b.dependents.join("; ")}`);
  }
  for (const u of unresolved) {
    console.error(`${dir}: could not reconcile ${u.name}@${u.installed}: ${u.reason}`);
  }
  if (bumped.length === 0 && unresolved.length === 0) {
    console.error(`${dir}: all overrides satisfy their dependents' ranges.`);
  }
  console.log(JSON.stringify({ bumped, unresolved }, null, 2));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.exitCode = main(process.argv.slice(2));
}
