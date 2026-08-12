// Shared by Home and Calendar — both need "is this recurring class session happening
// on this particular calendar day," which requires the same day-name vocabulary and
// time-string formatting either screen would otherwise duplicate. See AGENTS.md's
// "never copy component code between two screens" rule — this applies to this kind of
// small shared logic too, not just components.

export type ScheduleEntry = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  colourTag: string;
  scheduleDays: string[];
  scheduleTime: string;
  venue?: string;
  lecturer?: string;
};

export const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// scheduleTime is stored as a plain "HH:MM-HH:MM" 24h range (see
// convex/courses.ts#importCourseTimetable) — reformatted for display here rather than
// at write time, same "store the plain form, format at the read site" split the rest
// of this app already follows for dates.
function formatTime(hhmm: string): string {
  const [hourStr, minuteStr] = hhmm.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return hhmm;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

export function formatScheduleTime(raw: string): string {
  const [start, end] = raw.split('-');
  if (!start || !end) return raw;
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// Whether `dateMs` falls within the semester's own date range — a course section
// recurs weekly by day-of-week alone, so without this check a Saturday before term
// starts (or after it ends) would still show a class that isn't actually happening.
export function isWithinSemester(dateMs: number, semester: { startDate: number; endDate: number } | null | undefined) {
  return semester !== null && semester !== undefined && dateMs >= semester.startDate && dateMs <= semester.endDate;
}
