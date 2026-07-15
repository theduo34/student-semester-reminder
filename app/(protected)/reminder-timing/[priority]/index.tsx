import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

type Priority = 'critical' | 'important' | 'flexible';

export default function ReminderTimingScreen() {
  const { priority } = useLocalSearchParams<{ priority: Priority }>();

  // Interval picker, pushed from Settings. Where the resulting per-priority interval
  // preference is persisted (a Reminder field, a new table, or local-only) is still
  // open — see the scaffolding summary.

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-foreground">Reminder timing — {priority}</Text>
    </View>
  );
}
