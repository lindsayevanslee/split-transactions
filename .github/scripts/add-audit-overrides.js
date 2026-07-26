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

  // Plan a fix that stays within the package's current major version. Some
  // advisories can only be cleared by a major-version bump (e.g. a react-router
  // advisory fixed in 8.3.0 while the project is on 7.x). A major bump can break
  // the app, so we never apply one automatically — we record it for a human and
  // apply the best fix available *within* the current major instead.
  const currentMajor = currentMajorFor(name, vuln, packageJson);
  const { candidate, blocked } = planInMajorFix(vuln, currentMajor);

  // Flag every advisory that would require crossing a major boundary.
  for (const b of blocked) {
    skipped.push({
      name,
      severity: vuln.severity,
      reason: `Requires major-version upgrade (>= ${b.version}) — outside the patch/minor auto-fix policy; needs human review`,
      url: b.url,
    });
  }

  if (!candidate) {
    // Nothing fixable within the current major. If we didn't already flag a
    // major-only advisory above, the ranges were simply unparseable.
    if (blocked.length === 0) {
      skipped.push({
        name,
        severity: vuln.severity,
        reason: "Could not determine fix version from advisory ranges",
        url: getAdvisoryUrl(vuln),
      });
    }
    continue;
  }

  // The candidate is derived arithmetically from the advisory boundary
  // (e.g. "<=7.29.0" → "7.29.1"), so it may be a version that was never
  // published to npm. Pinning to a nonexistent version makes the subsequent
  // `npm install` abort with ETARGET, failing the whole workflow. Resolve the
  // candidate to the lowest *published* version that is >= candidate and,
  // when the current major is known, does not exceed it.
  const fixVersion = resolvePublishedVersion(name, candidate, currentMajor);

  if (!fixVersion) {
    const within = currentMajor != null ? ` within v${currentMajor}.x` : "";
    skipped.push({
      name,
      severity: vuln.severity,
      reason: `No published version >= ${candidate}${within} found on the npm registry`,
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

/** Major-version number of a version string ("7.18.1" → 7, "^8.3.0" → 8). */
function majorOf(version) {
  return Number(String(version).replace(/^[\^~]/, "").split(".")[0]) || 0;
}

/**
 * Determines the major version the package is currently on, so the fix can be
 * kept within it. Order of preference:
 *   1. A direct dependency's declared version.
 *   2. An existing override's version (for transitive deps already pinned).
 *   3. npm's own recommended fix, when it is a non-major bump.
 * Returns null when none of these apply — the caller then falls back to legacy
 * behavior (no major cap) rather than guessing.
 */
function currentMajorFor(name, vuln, packageJson) {
  const direct =
    packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
  if (direct) return majorOf(direct);

  if (packageJson.overrides?.[name]) return majorOf(packageJson.overrides[name]);

  const fa = vuln.fixAvailable;
  if (fa && typeof fa === "object" && fa.version && fa.isSemVerMajor === false) {
    return majorOf(fa.version);
  }

  return null;
}

/**
 * Extracts the fix upper bound from every advisory in the "via" array.
 * Returns [{ version, url }, ...] — one entry per advisory whose range parses.
 *
 * Examples of ranges → version:
 *   "<6.14.0"           → "6.14.0"
 *   ">=2.0.0 <2.0.3"    → "2.0.3"
 *   "<=1.3.3"           → "1.3.4" (bumps patch)
 */
function advisoryUpperBounds(vuln) {
  const out = [];
  for (const advisory of vuln.via.filter((v) => typeof v === "object")) {
    const version = extractUpperBound(advisory.range);
    if (version) out.push({ version, url: advisory.url || null });
  }
  return out;
}

/**
 * Splits a vulnerability's advisory fixes into what can be fixed within the
 * current major and what cannot.
 *
 * Returns:
 *   candidate — the highest in-major fix version to apply (or null if none), and
 *   blocked   — advisories whose fix requires a higher major version, which we
 *               refuse to auto-apply and hand to a human instead.
 *
 * When currentMajor is null (unknown), preserves the original behavior: take the
 * single highest fix across all advisories and block nothing.
 */
function planInMajorFix(vuln, currentMajor) {
  const bounds = advisoryUpperBounds(vuln);
  if (bounds.length === 0) return { candidate: null, blocked: [] };

  const highest = (list) =>
    list.reduce(
      (hi, b) => (!hi || compareVersions(b.version, hi) > 0 ? b.version : hi),
      null
    );

  if (currentMajor == null) {
    return { candidate: highest(bounds), blocked: [] };
  }

  const inMajor = bounds.filter((b) => majorOf(b.version) <= currentMajor);
  const blocked = bounds.filter((b) => majorOf(b.version) > currentMajor);
  return { candidate: highest(inMajor), blocked };
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
 * no published version satisfies the candidate. When maxMajor is provided,
 * versions above that major are excluded, so the fix never crosses a major
 * boundary even if the registry has newer majors published.
 */
function resolvePublishedVersion(name, candidate, maxMajor = null) {
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
    if (maxMajor != null && majorOf(v) > maxMajor) continue; // stay in-major
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
