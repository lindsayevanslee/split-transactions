/**
 * Guards the security properties of .github/workflows/security-audit.yml.
 *
 * These are plain-text checks (no YAML parser dependency) for settings that are
 * easy to undo by accident and fail silently when undone:
 *   - installs must not run dependency install scripts while the app token is
 *     stored in git config,
 *   - the default GITHUB_TOKEN stays read-only (all writes use the app token),
 *   - a failed `npm audit signatures` must fail the run, not just be logged.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

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
    expect(WORKFLOW.match(/echo "exit_code=\$\?" >> "\$GITHUB_OUTPUT"/g)).toHaveLength(2);
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
});
