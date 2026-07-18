import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { HomeHeader } from '@/components/features/dashboard/HomeHeader';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';

const today = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

function computeSemesterProgress(startDate: number, endDate: number) {
  const now = Date.now();
  const total = endDate - startDate;
  const elapsed = now - startDate;
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(0, Math.ceil((endDate - now) / msPerWeek));
  return { percent, weeksRemaining };
}

// Always renders the real shell (header + progress card) regardless of activity count
// — "no active semester" is the (onboarding) waiting screen's gate, handled before a
// student ever reaches here; by the time Home renders, a semester is guaranteed to
// exist. Only the content area below swaps between skeleton / empty state / activity
// list (the list itself is a later pass, see AGENTS.md).
export default function HomeScreen() {
  const router = useRouter();
  const viewer = useQuery(api.users.viewer);
  const semester = useQuery(api.semesters.getActive);
  const courseActivities = useQuery(
    api.courseActivities.listForStudent,
    viewer ? { studentId: viewer._id } : 'skip',
  );
  const personalTasks = useQuery(
    api.personalTasks.listForStudent,
    viewer ? { studentId: viewer._id } : 'skip',
  );

  const isLoading =
    viewer === undefined ||
    semester === undefined ||
    courseActivities === undefined ||
    personalTasks === undefined;

  const firstName = viewer?.name?.split(' ')[0] ?? 'Student';
  const avatarInitials = (viewer?.name ?? 'S').charAt(0).toUpperCase();
  const activityCount = (courseActivities?.length ?? 0) + (personalTasks?.length ?? 0);

  return (
    <Screen
      header={<HomeHeader date={today} name={firstName} avatarInitials={avatarInitials} />}
      className="gap-6 pt-4">
      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <>
          {semester ? (
            <ProgressCard
              title={semester.title}
              {...computeSemesterProgress(semester.startDate, semester.endDate)}
            />
          ) : null}

          {activityCount === 0 ? (
            <EmptyState onAddActivity={() => router.push('/add-activity')} />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted">Activity list — built in a later pass.</Text>
            </View>
          )}
        </>
      )}
    </Screen>
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

function EmptyState({ onAddActivity }: { onAddActivity: () => void }) {
  const [success] = useCSSVariable(['--success']) as [string];

  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1 items-center justify-center gap-3 px-6">
      <IconSymbol name="party.popper" size={40} color={success} />
      <Text className="text-center text-lg font-bold text-foreground">You&apos;re all caught up</Text>
      <Text className="text-center text-sm text-muted">
        No activities yet this semester. Add one to get reminders before it&apos;s due.
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
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-3/4 rounded-md" />
      </View>
    </View>
  );
}
