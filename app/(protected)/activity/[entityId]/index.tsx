import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

type EntityType = 'course' | 'semester' | 'personal';

export default function ActivityDetailsScreen() {
  const { entityId } = useLocalSearchParams<{ entityId: string; type?: EntityType }>();

  // TODO: resolve `type` against a single Convex resolver query (courseActivities ->
  // semesterActivities -> personalTasks in sequence) instead of trusting it blindly —
  // it may be missing or stale when navigated to from a notification. Then branch the
  // render by resolved kind: countdown card / read-only card / toggle view. One route,
  // branching render — not three screens to keep in sync. See AGENTS.md.

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-foreground">Activity {entityId}</Text>
    </View>
  );
}
