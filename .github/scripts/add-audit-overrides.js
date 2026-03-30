#!/usr/bin/env node

/**
 * Parses npm audit JSON output and adds overrides to package.json
 * for vulnerable transitive dependencies.
 *
 * Usage: node add-audit-overrides.js <audit-json-file> <package-json-file>
 *
 * Outputs a JSON summary to stdout:
 *   { added: [...], skipped: [...] }
 */

import { readFileSync, writeFileSync } from "fs";

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

const added = [];
const skipped = [];

for (const [name, vuln] of Object.entries(audit.vulnerabilities || {})) {
  // Skip direct dependencies — those can be fixed with npm update
  if (vuln.isDirect) {
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

  // Extract the fix version from advisory ranges in the "via" array.
  // Advisory ranges look like "<6.14.0" or ">=2.0.0 <2.0.3".
  // The fix version is the upper bound (the number after "<").
  const fixVersion = deriveFixVersion(vuln);

  if (!fixVersion) {
    skipped.push({
      name,
      severity: vuln.severity,
      reason: "Could not determine fix version from advisory ranges",
      url: getAdvisoryUrl(vuln),
    });
    continue;
  }

  const overrideValue = `^${fixVersion}`;

  // Skip if an override already exists at a sufficient version
  if (packageJson.overrides[name]) {
    const existing = packageJson.overrides[name].replace(/^\^/, "");
    if (compareVersions(existing, fixVersion) >= 0) {
      continue; // Existing override is already at or above the fix version
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

// Write the updated package.json preserving 2-space indent
writeFileSync(packageFile, JSON.stringify(packageJson, null, 2) + "\n");

// Output summary as JSON for the workflow to use
const summary = { added, skipped };
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
 * Simple semver comparison. Returns:
 *   positive if a > b, negative if a < b, 0 if equal
 */
function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Gets the first advisory URL from a vulnerability entry */
function getAdvisoryUrl(vuln) {
  const advisory = vuln.via.find((v) => typeof v === "object");
  return advisory?.url || null;
}
