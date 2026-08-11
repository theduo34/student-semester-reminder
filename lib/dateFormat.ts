// Extracted from the Academic Year Progress screen once the admin Semester Overview
// screen needed the exact same "Jan 5 – Jan 11" range format — see AGENTS.md's "never
// copy component code between two screens" rule (applies to small formatters too, not
// just components/mapping logic).
export function formatDateRange(startMs: number, endMs: number): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${new Date(startMs).toLocaleDateString(undefined, opts)} – ${new Date(endMs).toLocaleDateString(undefined, opts)}`;
}
