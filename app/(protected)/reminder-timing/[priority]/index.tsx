import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

type Priority = 'critical' | 'important' | 'flexible';

export default function ReminderTimingScreen() {
  const { priority } = useLocalSearchParams<{ priority: Priority }>();

  // Interval picker, pushed from Settings. Where the resulting per-priority interval
  // preference is persisted (a Reminder field, a new table, or local-only) is still
  // open — see CLAUDE.md's open questions.

  return (
    <Screen header={<AppTopBar left="back" title="Reminder Timing" />}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Reminder timing — {priority}</Text>
      </View>
    </Screen>
  );
}
