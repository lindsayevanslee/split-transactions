#!/usr/bin/env node

/**
 * Parses npm audit JSON output and fixes vulnerable dependencies in package.json.
 *
 * - Direct dependencies: bumps the version range in dependencies/devDependencies
 * - Transitive dependencies: adds an override entry
 *
 * Usage: node add-audit-overrides.js <audit-json-file> <package-json-file>
 *
 * Outputs a JSON summary to stdout:
 *   { added: [...], bumped: [...], skipped: [...] }
 */

import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

const [auditFile, packageFile] = process.argv.slice(2);

if (!auditFile || !packageFile) {
  console.error(
    "Usage: node add-audit-overrides.js <audit-json-file> <package-json-file>"
  );
  process.exit(1);
}

const audit = JSON.parse(readFileSync(auditFile, "utf8"));
const packageJsonRaw = readFileSync(packageFile, "utf8");
const packageJson = JSON.parse(packageJsonRaw);

if (!packageJson.overrides) {
  packageJson.overrides = {};
}

const added = []; // overrides added for transitive deps
const bumped = []; // direct deps bumped in dependencies/devDependencies
const skipped = [];

for (const [name, vuln] of Object.entries(audit.vulnerabilities || {})) {
  // Cascade reports: this entry has no direct advisory, it's just flagged
  // because a dependency of it has one. The real advisory will be listed
  // separately, and fixing that will clear this entry too. Skip silently.
  const hasDirectAdvisory = vuln.via.some((v) => typeof v === "object");
  if (!hasDirectAdvisory) {
    continue;
  }

  if (!vuln.fixAvailable) {
    skipped.push({
      name,
      severity: vuln.severity,
      reason: "No fix available",
      url: getAdvisoryUrl(vuln),
    });
    continue;
  }

  // Extract the candidate fix version from advisory ranges in the "via" array.
  // Advisory ranges look like "<6.14.0" or ">=2.0.0 <2.0.3".
  // The candidate is the upper bound (the number after "<").
  const candidate = deriveFixVersion(vuln);

  if (!candidate) {
    skipped.push({
      name,
      severity: vuln.severity,
      reason: "Could not determine fix version from advisory ranges",
      url: getAdvisoryUrl(vuln),
    });
    continue;
  }

  // The candidate is derived arithmetically from the advisory boundary
  // (e.g. "<=7.29.0" → "7.29.1"), so it may be a version that was never
  // published to npm. Pinning to a nonexistent version makes the subsequent
  // `npm install` abort with ETARGET, failing the whole workflow. Resolve the
  // candidate to the lowest *published* version that is >= candidate.
  const fixVersion = resolvePublishedVersion(name, candidate);

  if (!fixVersion) {
    skipped.push({
      name,
      severity: vuln.severity,
      reason: `No published version >= ${candidate} found on the npm registry`,
      url: getAdvisoryUrl(vuln),
    });
    continue;
  }

  if (vuln.isDirect) {
    // Direct dependency: bump the version range in dependencies or devDependencies
    const depSection = packageJson.dependencies?.[name]
      ? "dependencies"
      : packageJson.devDependencies?.[name]
        ? "devDependencies"
        : null;

    if (!depSection) continue;

    const existing = packageJson[depSection][name].replace(/^[\^~]/, "");
    if (compareVersions(existing, fixVersion) >= 0) {
      continue; // Already at or above the fix version
    }

    // Pin to exact version — no ranges, to avoid supply chain risk
    packageJson[depSection][name] = fixVersion;
    bumped.push({
      name,
      severity: vuln.severity,
      version: fixVersion,
      section: depSection,
      url: getAdvisoryUrl(vuln),
    });
  } else {
    // Transitive dependency: add an override pinned to exact version
    const overrideValue = fixVersion;

    // Skip if an override already exists at a sufficient version
    if (packageJson.overrides[name]) {
      const existing = packageJson.overrides[name].replace(/^[\^~]/, "");
      if (compareVersions(existing, fixVersion) >= 0) {
        continue;
      }
    }

    packageJson.overrides[name] = overrideValue;
    added.push({
      name,
      severity: vuln.severity,
      version: overrideValue,
      url: getAdvisoryUrl(vuln),
    });
  }
}

// Write the updated package.json preserving 2-space indent
writeFileSync(packageFile, JSON.stringify(packageJson, null, 2) + "\n");

// Output summary as JSON for the workflow to use
const summary = { added, bumped, skipped };
console.log(JSON.stringify(summary, null, 2));

// --- Helper functions ---

/**
 * Derives the minimum safe version from a vulnerability's advisory ranges.
 * Looks at all "via" entries (advisory objects) and extracts the upper bound
 * of each vulnerable range. Returns the highest fix version needed.
 *
 * Examples:
 *   "<6.14.0"           → "6.14.0"
 *   ">=2.0.0 <2.0.3"    → "2.0.3"
 *   "<=1.3.3"           → bumps patch: "1.3.4"
 */
function deriveFixVersion(vuln) {
  const advisories = vuln.via.filter((v) => typeof v === "object");
  if (advisories.length === 0) return null;

  let highestFix = null;

  for (const advisory of advisories) {
    const range = advisory.range;
    const version = extractUpperBound(range);
    if (version && (!highestFix || compareVersions(version, highestFix) > 0)) {
      highestFix = version;
    }
  }

  return highestFix;
}

/**
 * Extracts the upper bound version from a vulnerability range string.
 *
 * Handles patterns like:
 *   "<6.14.0"         → "6.14.0"
 *   ">=2.0.0 <2.0.3"  → "2.0.3"
 *   "<=1.3.3"         → "1.3.4" (bumps patch)
 */
function extractUpperBound(range) {
  // Match "<X.Y.Z" (strict less-than) — fix version is X.Y.Z
  const ltMatch = range.match(/<(\d+\.\d+\.\d+)/);
  if (ltMatch) {
    return ltMatch[1];
  }

  // Match "<=X.Y.Z" — fix version is X.Y.(Z+1)
  const lteMatch = range.match(/<=(\d+\.\d+\.\d+)/);
  if (lteMatch) {
    return bumpPatch(lteMatch[1]);
  }

  return null;
}

/** Bumps the patch version: "1.3.3" → "1.3.4" */
function bumpPatch(version) {
  const parts = version.split(".").map(Number);
  parts[2] += 1;
  return parts.join(".");
}

/**
 * Resolves a derived candidate version to the lowest version actually published
 * on the npm registry that is >= the candidate.
 *
 * npm advisory ranges describe the *vulnerable* set, so the boundary we derive
 * (e.g. "<=7.29.0" → "7.29.1") is not guaranteed to be a real release. Querying
 * the registry and picking the lowest published version that clears the
 * vulnerable boundary gives us a version that both exists and is safe.
 *
 * Returns the resolved version string, or null if the registry query fails or
 * no published version satisfies the candidate.
 */
function resolvePublishedVersion(name, candidate) {
  let versions;
  try {
    // `npm view <pkg> versions --json` returns a JSON array of all published
    // versions. execFileSync (not exec) avoids shell injection from the name.
    const out = execFileSync("npm", ["view", name, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(out);
    // A package with a single published version returns a string, not an array.
    versions = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null; // Registry unreachable or package not found — skip, don't guess.
  }

  // Consider only stable releases (skip prereleases like 1.0.0-beta.1) and pick
  // the lowest one that is >= the candidate.
  let best = null;
  for (const v of versions) {
    if (v.includes("-")) continue; // prerelease — not a safe auto-pin target
    if (compareVersions(v, candidate) < 0) continue;
    if (best === null || compareVersions(v, best) < 0) {
      best = v;
    }
  }

  return best;
}

/**
 * Semver comparison over the major.minor.patch core (prerelease/build metadata
 * is ignored). Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareVersions(a, b) {
  const core = (v) => v.split(/[-+]/)[0].split(".").map((n) => Number(n) || 0);
  const pa = core(a);
  const pb = core(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/** Gets the first advisory URL from a vulnerability entry */
function getAdvisoryUrl(vuln) {
  const advisory = vuln.via.find((v) => typeof v === "object");
  return advisory?.url || null;
}
