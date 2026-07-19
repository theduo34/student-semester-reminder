import { useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Skeleton, useThemeColor } from 'heroui-native';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, CalendarProvider, WeekCalendar } from 'react-native-calendars';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { ActivityCard } from '@/components/shared/ActivityCard';
import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';
import { toDateKey } from '@/lib/dateKey';

// react-native-calendars doesn't re-export its Theme/MarkedDates types from the package
// root (only from a deep `src/types` import) — declared inline here instead of reaching
// into the library's internals; still gets structurally checked against Calendar's own
// `theme`/`markedDates` props at each call site below.
//
// The three `'stylesheet.*'` entries and the nested `stylesheet.expandable.main` entry
// below are NOT part of the documented `Theme` interface (which claims a fully nested
// `stylesheet: { calendar: { main }, day: { basic } }` shape) — reading the library's
// actual source (v1.1314.0) shows most of these are read via flat, literal string keys
// (`theme['stylesheet.calendar.main']`), while the expandable/week-view styles are read
// via a genuinely nested path (`theme?.stylesheet?.expandable?.main`). The two don't
// match the same convention and don't match the TS type. This is undocumented internal
// surface, not a stable public contract — if a future library version restructures
// this, these specific overrides are what would silently stop applying. Verified by
// reading `calendar/style.js`, `calendar/header/style.js`, `calendar/day/basic/
// style.js`, and `expandableCalendar/style.js` directly rather than assumed.
type CalendarTheme = {
  backgroundColor?: string;
  calendarBackground?: string;
  textSectionTitleColor?: string;
  dayTextColor?: string;
  textDisabledColor?: string;
  todayTextColor?: string;
  selectedDayTextColor?: string;
  arrowColor?: string;
  monthTextColor?: string;
  textDayFontFamily?: string;
  textMonthFontFamily?: string;
  textDayHeaderFontFamily?: string;
  'stylesheet.calendar.main'?: { container: object };
  'stylesheet.calendar.header'?: { header: object };
  'stylesheet.day.basic'?: { today: object; selected: object };
  stylesheet?: { expandable?: { main?: { week: object } } };
};
type MarkedDateDot = { key: string; color: string };
type MarkedDateEntry = {
  dots?: MarkedDateDot[];
  selected?: boolean;
};

type ViewMode = 'month' | 'week';
type PriorityBucket = 'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE' | 'PERSONAL';

type CalendarActivity = {
  id: string;
  kind: 'courseActivity' | 'personalReminder' | 'semesterActivity';
  type: 'course' | 'personal' | 'semester';
  title: string;
  subtitle?: string;
  /** The calendar day this activity belongs to — always the entity's canonical "due"/"date" field, never a notification-timing field (see the personalReminders note below). This is the sole key used for bucketing; never derive the day from displayTime. */
  dueDate: number;
  /** What time to show on the card. For personal reminders this is startTime (when the reminder actually fires) — a different field than dueDate, and NOT guaranteed to fall on the same calendar day (see below), so it must never be used for bucketing. */
  displayTime: number;
  endTime?: number;
  courseColour?: string;
  isCompleted?: boolean;
  priorityBucket: PriorityBucket;
  /** Real stored/domain priority — CRITICAL by rule for semesterActivity — fed to ActivityCard, which is a different concept from priorityBucket above (that one always reads personalReminders as "Personal", this one never does; see AGENTS.md). */
  priority: 'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE';
  activityType?: 'ASSIGNMENT' | 'QUIZ' | 'PROJECT' | 'EXAM';
};

const RADIUS_MD = 8;

const LEGEND_ITEMS: { bucket: PriorityBucket; label: string; dotClassName: string }[] = [
  { bucket: 'CRITICAL', label: 'Critical', dotClassName: 'bg-critical' },
  { bucket: 'IMPORTANT', label: 'Important', dotClassName: 'bg-important' },
  { bucket: 'FLEXIBLE', label: 'Flexible', dotClassName: 'bg-flexible' },
  { bucket: 'PERSONAL', label: 'Personal', dotClassName: 'bg-personal' },
];

// Personal reminders always bucket as "Personal" regardless of their own priority tier
// — the calendar's dot system reads as "admin stuff, by urgency" vs. "your own stuff".
// SemesterActivities have no stored priority field — always CRITICAL by domain rule
// (see AGENTS.md), not read from data.
function priorityBucketFor(
  kind: CalendarActivity['kind'],
  priority: 'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE',
): PriorityBucket {
  return kind === 'personalReminder' ? 'PERSONAL' : priority;
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <View className="flex-row items-center rounded-full bg-surface-secondary p-0.5">
      {(['month', 'week'] as const).map((mode) => (
        <Pressable
          key={mode}
          onPress={() => onChange(mode)}
          className={`rounded-full px-3 py-1 ${value === mode ? 'bg-surface' : ''}`}>
          <Text className={`text-xs font-medium ${value === mode ? 'text-foreground' : 'text-muted'}`}>
            {mode === 'month' ? 'Month' : 'Week'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Month/Week toggle over react-native-calendars — see AGENTS.md, this is the project's
// one calendar library, no custom month grids. Both views live inside a single
// CalendarProvider (WeekCalendar needs it; Calendar doesn't but sharing the wrapper
// means toggling never unmounts/remounts a whole different tree, just swaps the leaf
// component) so the selected day survives switching views. markedDates/theme are
// memoized off the same underlying query data — recomputing either per render is a
// known perf sink with this library.
export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; view?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(Date.now()));

  // Deep-link support for Home's "View all" links (and any future external entry
  // point): `date`/`view` seed state whenever they're present, not just on first
  // mount — Expo Router's tab navigator keeps this screen alive across tab switches,
  // so a second navigation here with different params wouldn't otherwise re-run a
  // useState initializer. Absent params leave whatever's already selected untouched.
  useEffect(() => {
    if (params.date) {
      setSelectedDate(params.date);
    }
  }, [params.date]);
  useEffect(() => {
    if (params.view === 'month' || params.view === 'week') {
      setViewMode(params.view);
    }
  }, [params.view]);

  const [
    background,
    foreground,
    mutedColor,
    accentColor,
    accentForeground,
    criticalColor,
    importantColor,
    flexibleColor,
    personalColor,
    fontNormal,
    fontMedium,
    fontBold,
  ] = useCSSVariable([
    '--background',
    '--foreground',
    '--muted',
    '--accent',
    '--accent-foreground',
    '--critical',
    '--important',
    '--flexible',
    '--personal',
    '--font-normal',
    '--font-medium',
    '--font-bold',
  ]) as string[];
  // Selected (not-today) day's light fill — --accent-soft only exists as a
  // heroui-derived `--color-accent-soft` (a color-mix(accent 15%) formula), not a raw
  // custom property in global.css, so it needs heroui's own useThemeColor to resolve
  // (already used this way for accent-soft-foreground in components/ui/Button.tsx).
  const selectedTint = useThemeColor('accent-soft');

  const viewer = useQuery(api.users.viewer);
  const semester = useQuery(api.semesters.getActive);
  const courseActivitiesData = useQuery(
    api.courseActivities.listForStudent,
    viewer ? { studentId: viewer._id } : 'skip',
  );
  const personalRemindersData = useQuery(
    api.personalReminders.listMine,
    semester ? { semesterId: semester._id } : 'skip',
  );
  const semesterActivitiesData = useQuery(
    api.alerts.listBySemester,
    semester ? { semesterId: semester._id } : 'skip',
  );
  const coursesData = useQuery(
    api.courses.listMyCourses,
    semester ? { semesterId: semester._id } : 'skip',
  );

  const isLoading =
    viewer === undefined ||
    semester === undefined ||
    courseActivitiesData === undefined ||
    personalRemindersData === undefined ||
    semesterActivitiesData === undefined ||
    coursesData === undefined;

  const coursesById = useMemo(
    () => new Map((coursesData ?? []).map((course) => [course._id, course])),
    [coursesData],
  );

  const allActivities: CalendarActivity[] = useMemo(() => {
    const fromCourseActivities: CalendarActivity[] = (courseActivitiesData ?? []).map((activity) => {
      const course = coursesById.get(activity.courseId);
      return {
        id: activity._id,
        kind: 'courseActivity',
        type: 'course',
        title: activity.title,
        subtitle: course?.courseTitle,
        dueDate: activity.dueDate,
        displayTime: activity.dueDate,
        courseColour: course?.colourTag,
        isCompleted: activity.status === 'COMPLETED',
        priorityBucket: priorityBucketFor('courseActivity', activity.priority),
        priority: activity.priority,
        activityType: activity.activityType,
      };
    });

    // dueDate (the day this is for) and startTime (when it fires) are edited via two
    // independent date/time pickers in the reminder form and are NOT guaranteed to
    // land on the same calendar day — e.g. picking a due date next week without also
    // touching the time field leaves startTime on today. Bucketing must use dueDate;
    // startTime is display-only. Using startTime for bucketing was the actual bug that
    // made the agenda look like it wasn't filtering by day (reminders silently
    // clustered under today instead of their real due date).
    const fromPersonalReminders: CalendarActivity[] = (personalRemindersData ?? []).map((reminder) => {
      const course = reminder.courseId ? coursesById.get(reminder.courseId) : undefined;
      return {
        id: reminder._id,
        kind: 'personalReminder',
        type: 'personal',
        title: reminder.title,
        subtitle: course?.courseTitle,
        dueDate: reminder.dueDate,
        displayTime: reminder.startTime,
        endTime: reminder.endTime,
        courseColour: course?.colourTag,
        isCompleted: reminder.isCompleted,
        priorityBucket: 'PERSONAL',
        priority: reminder.priority,
      };
    });

    const fromSemesterActivities: CalendarActivity[] = (semesterActivitiesData ?? []).map((event) => ({
      id: event._id,
      kind: 'semesterActivity',
      type: 'semester',
      title: event.title,
      subtitle: 'Institutional event',
      dueDate: event.date,
      displayTime: event.date,
      isCompleted: false,
      priorityBucket: 'CRITICAL',
      priority: 'CRITICAL',
    }));

    return [...fromCourseActivities, ...fromPersonalReminders, ...fromSemesterActivities].sort(
      (a, b) => a.displayTime - b.displayTime,
    );
  }, [courseActivitiesData, personalRemindersData, semesterActivitiesData, coursesById]);

  // Keyed by dueDate (never displayTime) via the shared local-timezone toDateKey — see
  // lib/dateKey.ts. This is the single source both the grid's dots and the agenda below
  // read from, so they can never disagree about what's on a day.
  const activitiesByDay = useMemo(() => {
    const map = new Map<string, CalendarActivity[]>();
    for (const activity of allActivities) {
      const key = toDateKey(activity.dueDate);
      const existing = map.get(key);
      if (existing) {
        existing.push(activity);
      } else {
        map.set(key, [activity]);
      }
    }
    return map;
  }, [allActivities]);

  const bucketColor: Record<PriorityBucket, string> = useMemo(
    () => ({
      CRITICAL: criticalColor,
      IMPORTANT: importantColor,
      FLEXIBLE: flexibleColor,
      PERSONAL: personalColor,
    }),
    [criticalColor, importantColor, flexibleColor, personalColor],
  );

  const todayKey = toDateKey(Date.now());

  // Today never gets `selected: true` here even when it IS the selectedDate — today's
  // own (stronger) box style already applies via the theme's `stylesheet.day.basic.
  // today` override below, and the library's own day-cell logic checks `isSelected`
  // before `isToday` (selected would otherwise always win). Leaving today unmarked as
  // "selected" is what makes today's styling win when the two coincide, per the
  // wireframe's stated precedence — no dayComponent override needed for this, just not
  // asserting the weaker state.
  const markedDates: Record<string, MarkedDateEntry> = useMemo(() => {
    const marks: Record<string, MarkedDateEntry> = {};
    for (const [dateKey, activities] of activitiesByDay) {
      const buckets = Array.from(new Set(activities.map((activity) => activity.priorityBucket)));
      marks[dateKey] = { dots: buckets.map((bucket) => ({ key: bucket, color: bucketColor[bucket] })) };
    }
    if (selectedDate !== todayKey) {
      marks[selectedDate] = { ...(marks[selectedDate] ?? {}), selected: true };
    }
    return marks;
  }, [activitiesByDay, selectedDate, todayKey, bucketColor]);

  // Discrete font FILES per weight (Roboto-Regular/Medium/Bold), not a variable font —
  // setting fontWeight alongside a weighted fontFamily is redundant at best and, on
  // Android, can fight the already-bold file (fake-bolding or being ignored). Weight
  // comes entirely from which font FAMILY is picked per role below.
  //
  // Today vs. selected are two different treatments, not the same accent twice: today
  // gets a full accent fill + accent-foreground text (the wireframe's dark filled box);
  // a selected day that ISN'T today gets a light accent tint + regular foreground text.
  // Both boxes are --radius-md, not the library's default fully-round (16px) shape —
  // `stylesheet.day.basic` is where that gets overridden, since the top-level
  // `selectedDayBackgroundColor`/`todayBackgroundColor` props don't control corner
  // radius. `stylesheet.calendar.main`/`stylesheet.calendar.header`/`stylesheet.
  // expandable.main.week` zero out the library's internal horizontal padding (5px on
  // the month grid container, 10px on the header row, 15px on the week strip) so the
  // grid lines up exactly with the screen's own padding — see CLAUDE.md's "no
  // additional horizontal padding on nested content" rule.
  const calendarTheme: CalendarTheme = useMemo(
    () => ({
      backgroundColor: background,
      calendarBackground: background,
      textSectionTitleColor: mutedColor,
      dayTextColor: foreground,
      textDisabledColor: mutedColor,
      todayTextColor: accentForeground,
      selectedDayTextColor: foreground,
      arrowColor: mutedColor,
      monthTextColor: foreground,
      textDayFontFamily: fontNormal,
      textMonthFontFamily: fontBold,
      textDayHeaderFontFamily: fontMedium,
      'stylesheet.calendar.main': {
        container: { paddingLeft: 0, paddingRight: 0, backgroundColor: background },
      },
      'stylesheet.calendar.header': {
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingLeft: 0,
          paddingRight: 0,
          marginTop: 6,
          alignItems: 'center',
        },
      },
      'stylesheet.day.basic': {
        today: { backgroundColor: accentColor, borderRadius: RADIUS_MD },
        selected: { backgroundColor: selectedTint, borderRadius: RADIUS_MD },
      },
      stylesheet: {
        expandable: {
          main: {
            week: {
              marginTop: 7,
              marginBottom: 7,
              paddingRight: 0,
              paddingLeft: 0,
              flexDirection: 'row',
              justifyContent: 'space-around',
            },
          },
        },
      },
    }),
    [background, foreground, mutedColor, accentColor, accentForeground, selectedTint, fontNormal, fontMedium, fontBold],
  );

  const handleDayPress = (dateString: string) => setSelectedDate(dateString);

  const isSelectedToday = selectedDate === todayKey;
  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const selectedDayActivities = activitiesByDay.get(selectedDate) ?? [];

  return (
    <Screen header={<AppTopBar title="Calendar" right={<ViewToggle value={viewMode} onChange={setViewMode} />} />}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="gap-6 pb-10 pt-4">
        {isLoading ? (
          <CalendarSkeleton />
        ) : (
          <CalendarProvider date={selectedDate} onDateChanged={handleDayPress}>
            {viewMode === 'month' ? (
              <Calendar
                current={selectedDate}
                markingType="multi-dot"
                markedDates={markedDates}
                theme={calendarTheme}
                onDayPress={(day) => handleDayPress(day.dateString)}
              />
            ) : (
              <WeekCalendar
                markingType="multi-dot"
                markedDates={markedDates}
                theme={calendarTheme}
                onDayPress={(day) => handleDayPress(day.dateString)}
              />
            )}

            <View className="flex-row flex-wrap gap-x-4 gap-y-2">
              {LEGEND_ITEMS.map((item) => (
                <View key={item.bucket} className="flex-row items-center gap-1.5">
                  <View className={`size-2.5 rounded-full ${item.dotClassName}`} />
                  <Text className="text-xs text-muted">{item.label}</Text>
                </View>
              ))}
            </View>

            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-bold text-foreground">{selectedDateLabel}</Text>
                {isSelectedToday ? (
                  <View className="rounded-full bg-accent px-2 py-0.5">
                    <Text className="text-xs font-semibold text-accent-foreground">Today</Text>
                  </View>
                ) : null}
              </View>

              {selectedDayActivities.length === 0 ? (
                <View className="items-center justify-center rounded-md border border-dashed border-border py-8">
                  <Text className="text-sm text-muted">No activities scheduled</Text>
                </View>
              ) : (
                <View className="gap-2">
                  {selectedDayActivities.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      kind={activity.kind}
                      title={activity.title}
                      priority={activity.priority}
                      activityType={activity.activityType}
                      dueDate={activity.dueDate}
                      displayTime={activity.displayTime}
                      endTime={activity.endTime}
                      courseTitle={activity.subtitle}
                      isCompleted={activity.isCompleted}
                      hideDate
                      onPress={() =>
                        router.push({
                          pathname: '/activity/[entityId]',
                          params: { entityId: activity.id, type: activity.type },
                        })
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          </CalendarProvider>
        )}
      </ScrollView>
    </Screen>
  );
}

function CalendarSkeleton() {
  return (
    <View className="gap-6 pt-4">
      <Skeleton className="h-80 w-full rounded-md" />
      <Skeleton className="h-16 w-full rounded-md" />
      <View className="gap-3">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </View>
    </View>
  );
}
