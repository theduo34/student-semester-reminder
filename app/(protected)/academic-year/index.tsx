import { useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard } from '@/components/shared/ActivityCard';
import { CircularProgress } from '@/components/shared/CircularProgress';
import { api } from '@/convex/_generated/api';
import { mapCourseActivity, mapPersonalReminder, mapSemesterActivity, UnifiedActivity } from '@/lib/activityMapping';
import { computeSemesterProgress } from '@/lib/semesterProgress';

function formatDateRange(startMs: number, endMs: number): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${new Date(startMs).toLocaleDateString(undefined, opts)} – ${new Date(endMs).toLocaleDateString(undefined, opts)}`;
}

type SemesterView = {
  id: string;
  title: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  completed: number;
  total: number;
  activities: UnifiedActivity[];
};

// Pushed from Home's Academic Year Progress card (see AGENTS.md's Academic year
// section) — native header/back gesture, registered as a sibling of (tabs) in
// app/(protected)/_layout.tsx, same standing rule every other detail screen off a tab
// follows (see CLAUDE.md's Nested navigation section).
export default function AcademicYearScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const overview = useQuery(api.academicYears.getCurrentYearOverview);
  const [now] = useState(() => Date.now());

  const goToActivity = (activity: UnifiedActivity) => {
    router.push({ pathname: '/activity/[entityId]', params: { entityId: activity.id, type: activity.type } });
  };

  // Semester activities have no completion concept (institutional events can't be
  // "overdue" or "done" — see AGENTS.md's Priority model / Alerts feed sections), so
  // they're excluded from the completed/total counts but still shown in the activity
  // list below, same rule Home's own overdue detection already follows.
  const semesterViews: SemesterView[] = useMemo(() => {
    if (overview === undefined || overview === null) return [];
    return overview.semesters.map(({ semester, semesterActivities, personalReminders, courseActivities }) => {
      const completable = [...courseActivities.map(mapCourseActivity), ...personalReminders.map(mapPersonalReminder)];
      const activities = [...completable, ...semesterActivities.map(mapSemesterActivity)].sort(
        (a, b) => a.dueDate - b.dueDate,
      );
      return {
        id: semester._id,
        title: semester.title,
        startDate: semester.startDate,
        endDate: semester.endDate,
        isActive: semester.isActive,
        completed: completable.filter((activity) => activity.isCompleted).length,
        total: completable.length,
        activities,
      };
    });
  }, [overview]);

  const overallPercent = useMemo(() => {
    const totals = semesterViews.reduce(
      (acc, view) => ({ completed: acc.completed + view.completed, total: acc.total + view.total }),
      { completed: 0, total: 0 },
    );
    return totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;
  }, [semesterViews]);

  const isLoading = overview === undefined;

  return (
    <>
      <Stack.Screen options={{ title: overview?.year.title ?? 'Academic Year' }} />
      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-6 px-4 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {isLoading ? (
          <AcademicYearSkeleton />
        ) : overview === null ? (
          <Text className="pt-10 text-center text-sm text-muted">
            No active semester right now — check back once one is published.
          </Text>
        ) : (
          <>
            <View className="items-center gap-2 rounded-md border border-border bg-surface p-6">
              <CircularProgress percent={overallPercent} label="completed" />
              <Text className="text-center text-sm text-muted">
                {semesterViews.reduce((sum, v) => sum + v.completed, 0)} of{' '}
                {semesterViews.reduce((sum, v) => sum + v.total, 0)} activities completed across the {overview.year.title}{' '}
                academic year
              </Text>
            </View>

            {semesterViews.map((view) => (
              <SemesterSection key={view.id} view={view} now={now} onPressActivity={goToActivity} />
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

function SemesterSection({
  view,
  now,
  onPressActivity,
}: {
  view: SemesterView;
  now: number;
  onPressActivity: (activity: UnifiedActivity) => void;
}) {
  const { percent, weeksRemaining } = computeSemesterProgress(view.startDate, view.endDate, now);

  return (
    <View className="gap-3">
      <View className="gap-2 rounded-md border border-border bg-surface p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-foreground">{view.title}</Text>
          {view.isActive ? (
            <View className="rounded-full bg-accent/15 px-2 py-0.5">
              <Text className="text-[10px] font-semibold uppercase text-accent">Current</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-xs text-muted">{formatDateRange(view.startDate, view.endDate)}</Text>
        <View className="h-2 overflow-hidden rounded-full bg-border">
          <View className="h-2 rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted">
            {view.total > 0 ? `${view.completed}/${view.total} completed` : 'Nothing to complete yet'}
          </Text>
          <Text className="text-xs text-muted">
            {view.isActive ? `${weeksRemaining} weeks remaining` : `${percent}% of term elapsed`}
          </Text>
        </View>
      </View>

      {view.activities.length === 0 ? (
        <Text className="ml-1 text-sm text-muted">No activities this semester.</Text>
      ) : (
        <View className="gap-2">
          {view.activities.map((activity) => (
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

function AcademicYearSkeleton() {
  return (
    <View className="gap-6">
      <Skeleton className="h-56 w-full rounded-md" />
      <View className="gap-3">
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </View>
    </View>
  );
}
