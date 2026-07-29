// Extracted from the Home screen once the Academic Year Progress screen needed the
// exact same time-elapsed calculation per semester — see AGENTS.md's "never copy
// component code between two screens" rule.
export function computeSemesterProgress(startDate: number, endDate: number, now: number) {
  const total = endDate - startDate;
  const elapsed = now - startDate;
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(0, Math.ceil((endDate - now) / msPerWeek));
  return { percent, weeksRemaining };
}
