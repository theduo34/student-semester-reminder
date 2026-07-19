import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

export type ActivityCardKind = 'courseActivity' | 'personalReminder' | 'semesterActivity';
export type ActivityCardActivityType = 'ASSIGNMENT' | 'QUIZ' | 'PROJECT' | 'EXAM';
export type ActivityCardPriority = 'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE';

export type ActivityCardProps = {
  kind: ActivityCardKind;
  title: string;
  /** Always a real priority value — CRITICAL/IMPORTANT/FLEXIBLE for courseActivity/personalReminder's own stored field, CRITICAL by domain rule for semesterActivity (never stored — the caller resolves this, same as Activity Details does). Not Calendar's dot-legend "Personal" bucket, which is a UI-only grouping specific to that one screen. */
  priority: ActivityCardPriority;
  /** Only meaningful for kind === 'courseActivity' — picks the left icon (Exam/Quiz/Assignment/Project each read differently). Ignored for the other two kinds. */
  activityType?: ActivityCardActivityType;
  /** The canonical calendar-day field — courseActivity/personalReminder's dueDate, semesterActivity's date. Drives both the date-formatted subtitle and overdue detection; never derive either from displayTime. */
  dueDate: number;
  /** What time to actually display — defaults to dueDate. For personalReminders this is startTime, which can land on a different moment than dueDate (see lib/dateKey.ts's convention notes) but is what the clock-time portion of the subtitle reads. */
  displayTime?: number;
  endTime?: number;
  /** Only shown when hideDate is true — see below. */
  courseTitle?: string;
  isCompleted?: boolean;
  /** Calendar's agenda already shows the day once, in its own header line — pass true there so the subtitle shows course/kind context instead of repeating the date. Home's list spans multiple days and needs the date per-row (default). */
  hideDate?: boolean;
  onPress?: () => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((startOfLocalDay(toMs) - startOfLocalDay(fromMs)) / DAY_MS);
}

function formatClockTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatShortWeekdayDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
}

function buildSubtitle({
  kind,
  dueDate,
  displayTime,
  endTime,
  isCompleted,
  courseTitle,
  hideDate,
}: Pick<ActivityCardProps, 'kind' | 'dueDate' | 'displayTime' | 'endTime' | 'isCompleted' | 'courseTitle' | 'hideDate'>): {
  text: string;
  isOverdue: boolean;
} {
  if (hideDate) {
    if (courseTitle) return { text: courseTitle, isOverdue: false };
    if (kind === 'semesterActivity') return { text: 'Institutional event', isOverdue: false };
    return { text: 'Personal task', isOverdue: false };
  }

  const now = Date.now();
  // Semester activities are institutional events, not personal tasks that can be
  // "missed" — never shown as overdue, even once the day has passed.
  const isOverdue = kind !== 'semesterActivity' && !isCompleted && dueDate < now;
  if (isOverdue) {
    const days = daysBetween(dueDate, now);
    return { text: days <= 0 ? 'Overdue' : `Overdue by ${days} day${days === 1 ? '' : 's'}`, isOverdue: true };
  }

  const institutionalSuffix = kind === 'semesterActivity' ? ' — Institutional' : '';
  const isToday = startOfLocalDay(dueDate) === startOfLocalDay(now);
  if (isToday) {
    const time = displayTime ?? dueDate;
    const timeText = endTime !== undefined ? `${formatClockTime(time)} – ${formatClockTime(endTime)}` : formatClockTime(time);
    return { text: `Due today, ${timeText}${institutionalSuffix}`, isOverdue: false };
  }

  return { text: `${formatShortWeekdayDate(dueDate)}${institutionalSuffix}`, isOverdue: false };
}

function activityIconFor(kind: ActivityCardKind, activityType: ActivityCardActivityType | undefined, isOverdue: boolean): IconSymbolName {
  if (isOverdue) return 'exclamationmark.circle.fill';
  if (kind === 'semesterActivity') return 'graduationcap.fill';
  if (kind === 'personalReminder') return 'checklist';
  switch (activityType) {
    case 'EXAM':
      return 'exclamationmark.triangle.fill';
    case 'QUIZ':
      return 'books.vertical.fill';
    default:
      return 'doc.text';
  }
}

const PRIORITY_TINT_BG: Record<ActivityCardPriority, string> = {
  CRITICAL: 'bg-critical/15',
  IMPORTANT: 'bg-important/15',
  FLEXIBLE: 'bg-flexible/15',
};
const PRIORITY_TEXT: Record<ActivityCardPriority, string> = {
  CRITICAL: 'text-critical',
  IMPORTANT: 'text-important',
  FLEXIBLE: 'text-flexible',
};
const PRIORITY_LABEL: Record<ActivityCardPriority, string> = {
  CRITICAL: 'Critical',
  IMPORTANT: 'Important',
  FLEXIBLE: 'Flexible',
};

// The one activity row — Home's dashboard sections and Calendar's day agenda both
// render through this, per Wireframe_02. Each card is its own bordered rounded-md
// surface (not a ListGroup.Item sharing a container with hairline dividers, the
// pre-Wireframe-02 treatment) — callers stack them with a small gap, not a ListGroup.
export function ActivityCard({
  kind,
  title,
  priority,
  activityType,
  dueDate,
  displayTime,
  endTime,
  courseTitle,
  isCompleted,
  hideDate,
  onPress,
}: ActivityCardProps) {
  const colors = useCSSVariable(['--critical-foreground', '--important-foreground', '--flexible-foreground']) as string[];
  const [criticalForeground, importantForeground, flexibleForeground] = colors;
  const iconColor = { CRITICAL: criticalForeground, IMPORTANT: importantForeground, FLEXIBLE: flexibleForeground }[priority];

  const subtitle = buildSubtitle({ kind, dueDate, displayTime, endTime, isCompleted, courseTitle, hideDate });
  const icon = activityIconFor(kind, activityType, subtitle.isOverdue);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      className="flex-row items-center gap-3 rounded-md border border-border bg-surface p-3">
      <View className={`size-[34px] items-center justify-center rounded-md ${PRIORITY_TINT_BG[priority]}`}>
        <IconSymbol name={icon} size={17} color={iconColor} />
      </View>

      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          className={`text-[13px] font-medium ${isCompleted ? 'text-muted line-through' : 'text-foreground'}`}>
          {title}
        </Text>
        <Text numberOfLines={1} className={`text-[11px] ${subtitle.isOverdue ? 'text-critical' : 'text-muted'}`}>
          {subtitle.text}
        </Text>
      </View>

      <View className={`shrink-0 rounded-full px-2 py-0.5 ${PRIORITY_TINT_BG[priority]}`}>
        <Text className={`text-[10px] font-semibold ${PRIORITY_TEXT[priority]}`}>{PRIORITY_LABEL[priority]}</Text>
      </View>
    </Pressable>
  );
}
