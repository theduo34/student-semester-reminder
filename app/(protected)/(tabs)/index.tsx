import { useQuery } from 'convex/react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { ActivityCard, ActivityCardActivityType, ActivityCardKind, ActivityCardPriority } from '@/components/shared/ActivityCard';
import { HomeHeader } from '@/components/features/dashboard/HomeHeader';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';
import { toDateKey } from '@/lib/dateKey';

const today = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function computeSemesterProgress(startDate: number, endDate: number, now: number) {
  const total = endDate - startDate;
  const elapsed = now - startDate;
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(0, Math.ceil((endDate - now) / msPerWeek));
  return { percent, weeksRemaining };
}

type HomeActivity = {
  id: string;
  kind: ActivityCardKind;
  type: 'course' | 'personal' | 'semester';
  title: string;
  dueDate: number;
  displayTime: number;
  endTime?: number;
  isCompleted?: boolean;
  priority: ActivityCardPriority;
  activityType?: ActivityCardActivityType;
};

const OVERDUE_LIMIT = 1;
const TODAY_LIMIT = 3;
const UPCOMING_LIMIT = 2;

// Home renders course activities, personal reminders, and semester activities merged
// into three time-derived sections — see AGENTS.md's "Home section limits" note for
// the exact limits/deep-link targets. Unlike the old flat unified list, sections are
// deliberately non-overlapping: an item counts toward exactly one bucket (Overdue wins
// over Today, Today wins over Upcoming) rather than being duplicated across two.
export default function HomeScreen() {
  const router = useRouter();
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

  // Recomputed on focus (and every minute while focused) so "Today"/"Upcoming" don't
  // stay stale if the student leaves the app open past midnight — a plain Date.now()
  // captured once at mount would silently drift wrong the longer the app stays open.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const interval = setInterval(() => setNow(Date.now()), 60_000);
      return () => clearInterval(interval);
    }, []),
  );

  const activitiesLoading =
    courseActivitiesData === undefined || personalRemindersData === undefined || semesterActivitiesData === undefined;

  const allActivities: HomeActivity[] = useMemo(() => {
    const fromCourseActivities: HomeActivity[] = (courseActivitiesData ?? []).map((activity) => ({
      id: activity._id,
      kind: 'courseActivity',
      type: 'course',
      title: activity.title,
      dueDate: activity.dueDate,
      displayTime: activity.dueDate,
      isCompleted: activity.status === 'COMPLETED',
      priority: activity.priority,
      activityType: activity.activityType,
    }));

    const fromPersonalReminders: HomeActivity[] = (personalRemindersData ?? []).map((reminder) => ({
      id: reminder._id,
      kind: 'personalReminder',
      type: 'personal',
      title: reminder.title,
      dueDate: reminder.dueDate,
      displayTime: reminder.startTime,
      endTime: reminder.endTime,
      isCompleted: reminder.isCompleted,
      priority: reminder.priority,
    }));

    const fromSemesterActivities: HomeActivity[] = (semesterActivitiesData ?? []).map((event) => ({
      id: event._id,
      kind: 'semesterActivity',
      type: 'semester',
      title: event.title,
      dueDate: event.date,
      displayTime: event.date,
      isCompleted: false,
      priority: 'CRITICAL',
    }));

    return [...fromCourseActivities, ...fromPersonalReminders, ...fromSemesterActivities];
  }, [courseActivitiesData, personalRemindersData, semesterActivitiesData]);

  const { overdue, todaySchedule, upcoming } = useMemo(() => {
    const todayKey = toDateKey(now);
    const endOfToday = startOfLocalDay(now) + DAY_MS;
    const weekCutoff = now + 7 * DAY_MS;

    // Institutional events can't be "overdue" or marked complete — see
    // convex/schema.ts's semesterActivities table, which has no status field.
    const overdueItems = allActivities.filter(
      (activity) => activity.kind !== 'semesterActivity' && !activity.isCompleted && activity.dueDate < now,
    );
    const overdueIds = new Set(overdueItems.map((activity) => activity.id));

    const todayItems = allActivities.filter(
      (activity) => !overdueIds.has(activity.id) && toDateKey(activity.dueDate) === todayKey,
    );
    const todayIds = new Set(todayItems.map((activity) => activity.id));

    const upcomingItems = allActivities.filter(
      (activity) =>
        !overdueIds.has(activity.id) &&
        !todayIds.has(activity.id) &&
        activity.dueDate > endOfToday &&
        activity.dueDate <= weekCutoff,
    );

    const byDisplayTime = (a: HomeActivity, b: HomeActivity) => a.displayTime - b.displayTime;
    return {
      overdue: overdueItems.sort(byDisplayTime),
      todaySchedule: todayItems.sort(byDisplayTime),
      upcoming: upcomingItems.sort(byDisplayTime),
    };
  }, [allActivities, now]);

  const isLoading = viewer === undefined || semester === undefined || activitiesLoading;
  const isEverythingEmpty = overdue.length === 0 && todaySchedule.length === 0 && upcoming.length === 0;

  const firstName = viewer?.name?.split(' ')[0] ?? 'Student';
  const todayKey = toDateKey(now);

  const goToActivity = (activity: HomeActivity) => {
    router.push({ pathname: '/activity/[entityId]', params: { entityId: activity.id, type: activity.type } });
  };
  const goToProfile = () => router.push('/settings/profile');
  const goToAddActivity = () => router.push('/add-activity');

  return (
    <Screen
      header={<HomeHeader date={today} name={firstName} fullName={viewer?.name ?? ''} onAvatarPress={goToProfile} />}
      className="gap-6 pt-4">
      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow gap-6 pb-6">
          {semester ? (
            <ProgressCard
              title={semester.title}
              {...computeSemesterProgress(semester.startDate, semester.endDate, now)}
            />
          ) : null}

          {isEverythingEmpty ? (
            <EmptyState onAddActivity={goToAddActivity} />
          ) : (
            <>
              {overdue.length > 0 ? (
                <Section
                  title="Overdue"
                  isOverdue
                  count={overdue.length}
                  limit={OVERDUE_LIMIT}
                  items={overdue}
                  emptyText={null}
                  onPressActivity={goToActivity}
                  onViewAll={() => router.push({ pathname: '/calendar', params: { view: 'month' } })}
                />
              ) : null}

              <Section
                title="Today's schedule"
                count={todaySchedule.length}
                limit={TODAY_LIMIT}
                items={todaySchedule}
                emptyText="Nothing on your plate today."
                onPressActivity={goToActivity}
                onViewAll={() => router.push({ pathname: '/calendar', params: { view: 'month', date: todayKey } })}
              />

              <Section
                title="Upcoming this week"
                count={upcoming.length}
                limit={UPCOMING_LIMIT}
                items={upcoming}
                emptyText="No activities coming up this week."
                onPressActivity={goToActivity}
                onViewAll={() => router.push({ pathname: '/calendar', params: { view: 'week' } })}
              />
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({
  title,
  count,
  limit,
  items,
  emptyText,
  isOverdue,
  onPressActivity,
  onViewAll,
}: {
  title: string;
  count: number;
  limit: number;
  items: HomeActivity[];
  emptyText: string | null;
  isOverdue?: boolean;
  onPressActivity: (activity: HomeActivity) => void;
  onViewAll: () => void;
}) {
  const hasMore = count > limit;
  const visibleItems = items.slice(0, limit);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className={`text-base font-bold ${isOverdue ? 'text-critical' : 'text-foreground'}`}>{title}</Text>
        {hasMore ? (
          <Pressable onPress={onViewAll} hitSlop={8}>
            <Text className="text-sm font-medium text-accent">View more →</Text>
          </Pressable>
        ) : (
          <Text className={`text-sm ${isOverdue ? 'text-critical' : 'text-muted'}`}>{count}</Text>
        )}
      </View>

      {visibleItems.length === 0 && emptyText ? (
        <Text className="text-sm text-muted">{emptyText}</Text>
      ) : (
        <View className="gap-2">
          {visibleItems.map((activity) => (
            <ActivityCard
              key={activity.id}
              kind={activity.kind}
              title={activity.title}
              priority={activity.priority}
              activityType={activity.activityType}
              dueDate={activity.dueDate}
              displayTime={activity.displayTime}
              endTime={activity.endTime}
              isCompleted={activity.isCompleted}
              onPress={() => onPressActivity(activity)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ProgressCard({
  title,
  percent,
  weeksRemaining,
}: {
  title: string;
  percent: number;
  weeksRemaining: number;
}) {
  return (
    <View className="gap-3 rounded-md bg-accent p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-medium text-accent-foreground">{title}</Text>
        <Text className="text-base font-medium text-accent-foreground">{percent}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-accent-foreground/20">
        <View className="h-2 rounded-full bg-accent-foreground" style={{ width: `${percent}%` }} />
      </View>
      <Text className="text-sm text-accent-foreground/80">{weeksRemaining} weeks remaining</Text>
    </View>
  );
}

// Wireframe_11's full-screen "caught up" state — only when Overdue, Today, and
// Upcoming are ALL empty. Individual empty sections (see Section above) use
// lightweight inline text instead; this is reserved for the genuinely nothing-to-do
// case, not shown per-section.
function EmptyState({ onAddActivity }: { onAddActivity: () => void }) {
  const [success] = useCSSVariable(['--success']) as [string];

  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1 items-center justify-center gap-3 px-6 py-10">
      <IconSymbol name="party.popper" size={40} color={success} />
      <Text className="text-center text-lg font-bold text-foreground">You&apos;re all caught up</Text>
      <Text className="text-center text-sm text-muted">
        No activities yet this semester. Add a reminder to get nudged before it&apos;s due.
      </Text>
      <Button onPress={onAddActivity} className="w-auto self-center px-6">
        Add your first activity
      </Button>
    </Animated.View>
  );
}

function HomeSkeleton() {
  return (
    <View className="gap-6">
      <Skeleton className="h-24 w-full rounded-md" />
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-4 w-6 rounded-md" />
        </View>
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </View>
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-4 w-6 rounded-md" />
        </View>
        <Skeleton className="h-16 w-full rounded-md" />
      </View>
    </View>
  );
}
