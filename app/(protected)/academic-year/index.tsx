import { useQuery } from 'convex/react';
import { Stack, useRouter } from 'expo-router';
import { Skeleton, useThemeColor } from 'heroui-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AcademicPeriodPicker } from '@/components/features/academic-year/AcademicPeriodPicker';
import { ActivityCard } from '@/components/shared/ActivityCard';
import { CircularProgress } from '@/components/shared/CircularProgress';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { mapCourseActivity, mapPersonalReminder, mapSemesterActivity, UnifiedActivity } from '@/lib/activityMapping';
import { formatDateRange } from '@/lib/dateFormat';
import { computeSemesterProgress } from '@/lib/semesterProgress';

const ACTIVITIES_PAGE_SIZE = 5;

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
// follows (see CLAUDE.md's Nested navigation section). Always shows ONE semester's
// progress, defaulting to the currently active one — never both semesters of the
// academic year at once, see the three-dot picker below for switching which one.
export default function AcademicYearScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const muted = useThemeColor('muted');
  const [now] = useState(() => Date.now());
  const [selectedSemesterId, setSelectedSemesterId] = useState<Id<'semesters'> | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const activeSemester = useQuery(api.semesters.getActive);
  const effectiveSemesterId = selectedSemesterId ?? activeSemester?._id;
  const overview = useQuery(
    api.academicYears.getSemesterOverview,
    effectiveSemesterId ? { semesterId: effectiveSemesterId } : 'skip',
  );

  // Still waiting to learn which semester is active, and the student hasn't picked one
  // of their own yet — this is the only case where there's genuinely nothing to query.
  const isResolvingActiveSemester = selectedSemesterId === null && activeSemester === undefined;
  const hasNoActiveSemester = selectedSemesterId === null && activeSemester === null;
  const isLoadingOverview = effectiveSemesterId !== undefined && overview === undefined;
  const isLoading = isResolvingActiveSemester || isLoadingOverview;

  const goToActivity = (activity: UnifiedActivity) => {
    router.push({ pathname: '/activity/[entityId]', params: { entityId: activity.id, type: activity.type } });
  };

  const handleViewCurrent = () => setSelectedSemesterId(null);

  // Semester activities have no completion concept (institutional events can't be
  // "overdue" or "done" — see AGENTS.md's Priority model / Alerts feed sections), so
  // they're excluded from the completed/total counts but still shown in the activity
  // list below, same rule Home's own overdue detection already follows.
  const view: SemesterView | null = useMemo(() => {
    if (!overview) return null;
    const { semester, semesterActivities, personalReminders, courseActivities } = overview.semester;
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
  }, [overview]);

  const percentComplete = view && view.total > 0 ? Math.round((view.completed / view.total) * 100) : 0;
  // Only worth offering "jump to current" when the semester being shown genuinely
  // isn't the active one AND an active one actually exists to jump to.
  const showJumpToCurrent = view !== null && !view.isActive && activeSemester != null;

  return (
    <>
      <Stack.Screen
        options={{
          title: view?.title ?? 'Academic progress',
          headerRight: () => (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Choose which academic period to view"
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 17,
                backgroundColor: 'transparent',
                opacity: pressed ? 0.4 : 1,
              })}
              onPress={() => setIsPickerOpen(true)}>
              <IconSymbol name="ellipsis" color={muted} size={20} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-6 px-4 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {isLoading ? (
          <AcademicYearSkeleton />
        ) : hasNoActiveSemester ? (
          <Text className="pt-10 text-center text-sm text-muted">
            No active semester right now — check back once one is published.
          </Text>
        ) : !overview || !view ? (
          <Text className="pt-10 text-center text-sm text-muted">
            That semester hasn&apos;t been published, or has nothing to show yet.
          </Text>
        ) : (
          <>
            {showJumpToCurrent ? <ViewingBanner onViewCurrent={handleViewCurrent} /> : null}

            <View className="items-center gap-2 rounded-md border border-border bg-surface p-6">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted">{overview.year.title}</Text>
              <CircularProgress percent={percentComplete} label="completed" />
              <Text className="text-center text-sm text-muted">
                {view.completed} of {view.total} activities completed in {view.title}
              </Text>
            </View>

            <SemesterSection key={view.id} view={view} now={now} onPressActivity={goToActivity} />
          </>
        )}
      </ScrollView>

      <AcademicPeriodPicker
        isOpen={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        selectedSemesterId={effectiveSemesterId ?? null}
        onSelect={setSelectedSemesterId}
        onViewCurrent={handleViewCurrent}
      />
    </>
  );
}

function ViewingBanner({ onViewCurrent }: { onViewCurrent: () => void }) {
  const accent = useThemeColor('accent');
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-md border border-accent/25 bg-accent/5 px-4 py-3">
      <View className="flex-1 flex-row items-center gap-2">
        <IconSymbol name="calendar" size={16} color={accent} />
        <Text className="flex-1 text-xs font-medium text-foreground">Viewing a different semester</Text>
      </View>
      <Pressable hitSlop={8} onPress={onViewCurrent}>
        <Text className="text-xs font-semibold text-accent">Current</Text>
      </Pressable>
    </View>
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
  const [visibleCount, setVisibleCount] = useState(ACTIVITIES_PAGE_SIZE);

  const visibleActivities = view.activities.slice(0, visibleCount);
  const remaining = view.activities.length - visibleActivities.length;

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
          {visibleActivities.map((activity) => (
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
          {remaining > 0 ? (
            <Button variant="secondary" size="sm" onPress={() => setVisibleCount((count) => count + ACTIVITIES_PAGE_SIZE)}>
              {`Load ${Math.min(remaining, ACTIVITIES_PAGE_SIZE)} more`}
            </Button>
          ) : null}
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
