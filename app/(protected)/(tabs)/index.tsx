import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ListGroup, Separator, Skeleton } from 'heroui-native';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { ActivityCard } from '@/components/shared/ActivityCard';
import { HomeHeader } from '@/components/features/dashboard/HomeHeader';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { getInitials } from '@/lib/initials';

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

type UnifiedActivity = {
  id: string;
  kind: 'courseActivity' | 'personalReminder';
  type: 'course' | 'personal';
  title: string;
  subtitle?: string;
  startTime: number;
  endTime?: number;
  courseColour?: string;
  isCompleted: boolean;
};

// Merges admin-published course activities with the student's own personal reminders
// into one time-sorted list — see AGENTS.md's Display integration note. Course colour
// always wins as the accent (resolved via courseId, whichever entity it's attached to);
// ActivityCard is what decides whether that also earns a "yours to edit" dot.
function buildUnifiedActivities(
  courseActivities: Doc<'courseActivities'>[],
  personalReminders: Doc<'personalReminders'>[],
  coursesById: Map<string, Doc<'courses'>>,
): UnifiedActivity[] {
  const fromCourseActivities: UnifiedActivity[] = courseActivities.map((activity) => {
    const course = coursesById.get(activity.courseId);
    return {
      id: activity._id,
      kind: 'courseActivity',
      type: 'course',
      title: activity.title,
      subtitle: course?.courseTitle,
      startTime: activity.dueDate,
      courseColour: course?.colourTag,
      isCompleted: activity.status === 'COMPLETED',
    };
  });

  const fromPersonalReminders: UnifiedActivity[] = personalReminders.map((reminder) => {
    const course = reminder.courseId ? coursesById.get(reminder.courseId) : undefined;
    return {
      id: reminder._id,
      kind: 'personalReminder',
      type: 'personal',
      title: reminder.title,
      subtitle: course?.courseTitle,
      startTime: reminder.startTime,
      endTime: reminder.endTime,
      courseColour: course?.colourTag,
      isCompleted: reminder.isCompleted,
    };
  });

  return [...fromCourseActivities, ...fromPersonalReminders].sort((a, b) => a.startTime - b.startTime);
}

// Always renders the real shell (header + progress card) regardless of activity count
// — "no active semester" is the (onboarding) waiting screen's gate, handled before a
// student ever reaches here; by the time Home renders, a semester is guaranteed to
// exist. Only the content area below swaps between skeleton / empty state / activity
// list. Calendar and Alerts don't render this unified list yet — they're still bare
// placeholders with no list infrastructure of their own, see CLAUDE.md.
export default function HomeScreen() {
  const router = useRouter();
  const viewer = useQuery(api.users.viewer);
  const semester = useQuery(api.semesters.getActive);
  const courseActivities = useQuery(
    api.courseActivities.listForStudent,
    viewer ? { studentId: viewer._id } : 'skip',
  );
  const personalReminders = useQuery(
    api.personalReminders.listMine,
    semester ? { semesterId: semester._id } : 'skip',
  );
  const courses = useQuery(api.courses.listMyCourses, semester ? { semesterId: semester._id } : 'skip');

  const isLoading =
    viewer === undefined ||
    semester === undefined ||
    courseActivities === undefined ||
    personalReminders === undefined ||
    courses === undefined;

  const firstName = viewer?.name?.split(' ')[0] ?? 'Student';
  const avatarInitials = getInitials(viewer?.name) || 'S';

  const coursesById = new Map((courses ?? []).map((course) => [course._id, course]));
  const activities = buildUnifiedActivities(courseActivities ?? [], personalReminders ?? [], coursesById);

  return (
    <Screen
      header={<HomeHeader date={today} name={firstName} avatarInitials={avatarInitials} />}
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
              {...computeSemesterProgress(semester.startDate, semester.endDate)}
            />
          ) : null}

          {activities.length === 0 ? (
            <EmptyState onAddActivity={() => router.push('/add-activity')} />
          ) : (
            <ListGroup className="rounded-md">
              {activities.map((activity, index) => (
                <View key={activity.id}>
                  {index > 0 ? <Separator className="mx-4" /> : null}
                  <ActivityCard
                    kind={activity.kind}
                    title={activity.title}
                    subtitle={activity.subtitle}
                    startTime={activity.startTime}
                    endTime={activity.endTime}
                    courseColour={activity.courseColour}
                    isCompleted={activity.isCompleted}
                    onPress={() =>
                      router.push({
                        pathname: '/activity/[entityId]',
                        params: { entityId: activity.id, type: activity.type },
                      })
                    }
                  />
                </View>
              ))}
            </ListGroup>
          )}
        </ScrollView>
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
        No activities yet this semester. Add a reminder to get nudged before it&apos;s due.
      </Text>
      <Button onPress={onAddActivity} className="w-auto self-center px-6">
        Add your first reminder
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
