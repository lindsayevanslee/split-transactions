/**
 * Picks the summary out of `npm audit signatures` output for the security
 * audit PR description.
 *
 * The summary lines are the counts ("404 packages have verified registry
 * signatures", "1 package has an invalid registry signature:", ...). Taking the
 * last line instead broke when npm 11 started ending the output with a
 * "(use --json --include-attestations ...)" hint.
 *
 * Falls back to the first non-empty line when there are no count lines, so an
 * error such as "npm error Failed to download" still shows up.
 */
export function signatureSummary(output) {
  const lines = output
    .replace(/\x1b\[[0-9;]*m/g, "") // in case npm colours its output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const counts = lines
    .filter((l) => /^\d+ packages? (has|have) /.test(l))
    .map((l) => l.replace(/:$/, ""));
  if (counts.length > 0) return counts.join("; ");
  return lines[0] ?? "(no output)";
}
