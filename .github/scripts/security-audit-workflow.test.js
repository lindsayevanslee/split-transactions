/**
 * Guards the security properties of .github/workflows/security-audit.yml.
 *
 * These are plain-text checks (no YAML parser dependency) for settings that are
 * easy to undo by accident and fail silently when undone:
 *   - installs must not run dependency install scripts while the app token is
 *     stored in git config,
 *   - the default GITHUB_TOKEN stays read-only (all writes use the app token),
 *   - a failed `npm audit signatures` must fail the run, not just be logged,
 *   - the app token uses client-id (app-id is deprecated by the action),
 *   - overrides are reconciled with their dependents' ranges and checked with
 *     the same command CI runs before the PR is opened, so the PR does not
 *     fail its own override-range check (PR #71: fast-xml-parser 5.12.0 wants
 *     fast-xml-builder ^1.3.1, but the older 1.1.7 override was left behind).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseArgs } from "./check-override-ranges.js";

const WORKFLOW = readFileSync(
  resolve(process.cwd(), ".github/workflows/security-audit.yml"),
  "utf8"
);
const lines = WORKFLOW.split("\n");

/**
 * Lines that run the given npm subcommand, either inline (`run: npm ...`) or
 * as a line of a `run: |` script. Comments and messages that merely mention
 * the command are excluded.
 */
function npmCommandLines(subcommand) {
  const pattern = new RegExp(`^(run: )?npm ${subcommand}\\b`);
  return lines.filter((l) => pattern.test(l.trim()));
}

/** The top-level `permissions:` block, as its indented child lines. */
function topLevelPermissions() {
  const start = lines.indexOf("permissions:");
  expect(start).toBeGreaterThanOrEqual(0);
  const block = [];
  for (const l of lines.slice(start + 1)) {
    if (!l.startsWith("  ")) break;
    block.push(l.trim());
  }
  return block;
}

describe("security-audit workflow", () => {
  it("never runs dependency install scripts", () => {
    const installs = [...npmCommandLines("ci"), ...npmCommandLines("install")];
    expect(installs.length).toBeGreaterThanOrEqual(4);
    for (const l of installs) {
      expect(l).toContain("--ignore-scripts");
    }
  });

  it("authenticates the audit app with client-id, not the deprecated app-id", () => {
    expect(WORKFLOW).toContain("client-id: ${{ secrets.AUDIT_APP_CLIENT_ID }}");
    expect(WORKFLOW).not.toMatch(/^\s+app-id:/m);
  });

  it("keeps the default GITHUB_TOKEN read-only", () => {
    expect(topLevelPermissions()).toEqual(["contents: read"]);
    // No job-level block may widen it again.
    expect(WORKFLOW).not.toMatch(/^\s+(contents|pull-requests):\s*write/m);
  });

  it("records the npm audit signatures exit code instead of swallowing it", () => {
    const sigLines = npmCommandLines("audit signatures");
    expect(sigLines).toHaveLength(2);
    for (const l of sigLines) {
      expect(l).not.toContain("|| true");
      expect(l).not.toContain("| tee"); // a pipe would hide npm's exit code
    }
    // The exit code is captured on the very next line of each script.
    for (const l of sigLines) {
      const next = lines[lines.indexOf(l) + 1];
      expect(next.trim()).toBe('echo "exit_code=$?" >> "$GITHUB_OUTPUT"');
    }
  });

  it("decides signature failures from exit codes, not by grepping the output", () => {
    expect(WORKFLOW).not.toMatch(/grep[^\n]*signatures\.txt/);
    expect(WORKFLOW).toContain("steps.root-signatures.outputs.exit_code");
    expect(WORKFLOW).toContain("steps.functions-signatures.outputs.exit_code");
  });

  it("fails the run when signature verification fails", () => {
    const idx = lines.findIndex((l) =>
      l.includes("if: steps.signatures.outputs.has_failures == 'true'")
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const step = lines.slice(idx, idx + 5).join("\n");
    expect(step).toMatch(/exit 1/);
    // It must come after the PR step so fixes are still proposed.
    expect(idx).toBeGreaterThan(lines.findIndex((l) => l.includes("name: Create or update PR")));
  });

  describe("override range reconciliation", () => {
    const stepIndex = (name) => lines.findIndex((l) => l.trim() === `- name: ${name}`);
    const scriptLines = (script) =>
      lines.filter((l) => l.trim().startsWith(`node .github/scripts/${script}`));
    const argsOf = (line, script) =>
      parseArgs(line.trim().replace(`node .github/scripts/${script}`, "").split(">")[0].trim().split(/\s+/));

    const ciCheckArgs = () => {
      const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
      const line = ci
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("run: node .github/scripts/check-override-ranges.js"));
      return argsOf(line.replace("run: ", ""), "check-override-ranges.js");
    };

    it("reconciles both projects' overrides after the audit overrides are added", () => {
      const runs = scriptLines("reconcile-overrides.js");
      expect(runs).toHaveLength(2);
      const dirs = runs.map((l) => argsOf(l, "reconcile-overrides.js").dirs).flat();
      expect(dirs.sort()).toEqual([".", "functions"]);
      // Same --allow list as the check, so a mismatch kept on purpose is not "fixed".
      for (const l of runs) {
        expect([...argsOf(l, "reconcile-overrides.js").allow]).toEqual([...ciCheckArgs().allow]);
      }
      const lastAddOverrides = Math.max(
        stepIndex("Add overrides for root vulnerabilities"),
        stepIndex("Add overrides for functions vulnerabilities")
      );
      expect(lastAddOverrides).toBeGreaterThanOrEqual(0);
      for (const l of runs) expect(lines.indexOf(l)).toBeGreaterThan(lastAddOverrides);
    });

    it("regenerates each lockfile after reconciling, before the check runs", () => {
      const check = lines.findIndex((l) => l.trim().startsWith("node .github/scripts/check-override-ranges.js"));
      for (const run of scriptLines("reconcile-overrides.js")) {
        const at = lines.indexOf(run);
        const regen = lines.findIndex(
          (l, i) => i > at && /^npm install --package-lock-only\b/.test(l.trim().replace(/^run: /, ""))
        );
        expect(regen).toBeGreaterThan(at);
        expect(regen).toBeLessThan(check);
      }
    });

    it("runs the same override range check as CI before opening the PR", () => {
      const runs = scriptLines("check-override-ranges.js");
      expect(runs).toHaveLength(1);
      const args = argsOf(runs[0], "check-override-ranges.js");
      const ci = ciCheckArgs();
      expect(args.dirs.sort()).toEqual(ci.dirs.sort());
      expect([...args.allow].sort()).toEqual([...ci.allow].sort());
      const at = lines.indexOf(runs[0]);
      expect(at).toBeLessThan(stepIndex("Check for changes"));
      expect(at).toBeLessThan(stepIndex("Create or update PR"));
      // Its exit code is captured rather than swallowed.
      expect(runs[0]).not.toContain("|| true");
      expect(lines[at + 1].trim()).toBe('echo "exit_code=$?" >> "$GITHUB_OUTPUT"');
    });

    it("fails the run after the PR step when the check fails", () => {
      const idx = lines.findIndex((l) =>
        l.includes("if: steps.override-check.outputs.exit_code != '0'")
      );
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(lines.slice(idx, idx + 5).join("\n")).toMatch(/exit 1/);
      expect(idx).toBeGreaterThan(stepIndex("Create or update PR"));
    });

    it("mentions the reconciliation and the check result in the PR body", () => {
      const start = stepIndex("Build PR description");
      const end = stepIndex("Create or update PR");
      const body = lines.slice(start, end).join("\n");
      expect(body).toContain("/tmp/root-reconcile.json");
      expect(body).toContain("/tmp/functions-reconcile.json");
      expect(body).toContain("OVERRIDE_CHECK_EXIT: ${{ steps.override-check.outputs.exit_code }}");
      expect(body).toContain("/tmp/override-check.txt");
      // The reconcile script writes these files, so the body reads what it wrote.
      expect(WORKFLOW).toContain("reconcile-overrides.js --allow @grpc/grpc-js . > /tmp/root-reconcile.json");
      expect(WORKFLOW).toContain("reconcile-overrides.js --allow @grpc/grpc-js functions > /tmp/functions-reconcile.json");
    });
  });
});
