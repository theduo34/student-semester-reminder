export type Priority = 'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE';

// Minute values must match convex/reminders.ts's DEFAULT_INTERVALS_MINUTES exactly —
// summary/label lookups below match on minutes, not on any stored label.
export const INTERVAL_OPTIONS = [
  { minutes: 10080, label: '1 week before', shortLabel: '1 week' },
  { minutes: 4320, label: '3 days before', shortLabel: '3 days' },
  { minutes: 1440, label: '1 day before', shortLabel: '1 day' },
  { minutes: 720, label: '12 hours before', shortLabel: '12 hours' },
  { minutes: 60, label: '1 hour before', shortLabel: '1 hour' },
  { minutes: 30, label: '30 minutes before', shortLabel: '30 min' },
  { minutes: 0, label: 'At deadline', shortLabel: 'At deadline' },
] as const;

// Groups INTERVAL_OPTIONS for the reminder-timing screen's three sections. A function
// (not a static partition) so it stays correct if options are ever added/removed above.
export const INTERVAL_GROUPS: { title: string; options: typeof INTERVAL_OPTIONS[number][] }[] = [
  { title: 'Days before', options: INTERVAL_OPTIONS.filter((option) => option.minutes >= 1440) },
  {
    title: 'Hours before',
    options: INTERVAL_OPTIONS.filter((option) => option.minutes > 0 && option.minutes < 1440),
  },
  { title: 'At deadline', options: INTERVAL_OPTIONS.filter((option) => option.minutes === 0) },
];

export function formatIntervalsSummary(intervals: number[]): string {
  if (intervals.length === 0) {
    return 'No reminders set';
  }
  return intervals
    .slice()
    .sort((a, b) => b - a)
    .map((minutes) => INTERVAL_OPTIONS.find((option) => option.minutes === minutes)?.shortLabel ?? `${minutes}m`)
    .join(', ');
}
