import { Text, View } from 'react-native';

import { HomeHeader } from '@/components/features/dashboard/HomeHeader';
import { Screen } from '@/components/ui/Screen';

// Static placeholders only — no auth/data wiring yet.
const STUDENT_NAME = 'Student';
const SEMESTER_NAME = 'Fall Semester';
const SEMESTER_PROGRESS_PERCENT = 45;
const WEEKS_REMAINING = 8;

const today = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

// Home dashboard structural skeleton: HomeHeader greeting, semester progress card, and
// a content-area stand-in for the today/upcoming/overdue sections (or the empty state)
// — the real list/empty-state logic is a separate pass.
export default function HomeScreen() {
  return (
    <Screen
      header={<HomeHeader date={today} name={STUDENT_NAME} avatarInitials={STUDENT_NAME.charAt(0)} />}
      className="gap-6 pt-4">
      {/* Semester progress card — first item in the content area, directly under the header. */}
      <View className="gap-3 rounded-md bg-accent p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-medium text-accent-foreground">{SEMESTER_NAME}</Text>
          <Text className="text-base font-medium text-accent-foreground">
            {SEMESTER_PROGRESS_PERCENT}%
          </Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-accent-foreground/20">
          <View
            className="h-2 rounded-full bg-accent-foreground"
            style={{ width: `${SEMESTER_PROGRESS_PERCENT}%` }}
          />
        </View>
        <Text className="text-sm text-accent-foreground/80">
          {WEEKS_REMAINING} weeks remaining
        </Text>
      </View>

      {/* Today/upcoming/overdue sections, or the empty state — built in a later pass. */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted">Content goes here</Text>
      </View>
    </Screen>
  );
}
