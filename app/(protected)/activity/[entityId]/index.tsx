import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';

type EntityType = 'course' | 'semester' | 'personal';

export default function ActivityDetailsScreen() {
  const { entityId } = useLocalSearchParams<{ entityId: string; type?: EntityType }>();
  const [muted] = useCSSVariable(['--muted']) as [string];

  // TODO: resolve `type` against a single Convex resolver query (courseActivities ->
  // semesterActivities -> personalTasks in sequence) instead of trusting it blindly —
  // it may be missing or stale when navigated to from a notification. Then branch the
  // render by resolved kind: countdown card / read-only card / toggle view. One route,
  // branching render — not three screens to keep in sync. See AGENTS.md.

  return (
    <Screen
      header={
        <AppTopBar
          left="back"
          title="Activity Details"
          titleVariant="muted"
          right={<IconSymbol name="ellipsis" color={muted} size={20} />}
        />
      }>
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Activity {entityId}</Text>
      </View>
    </Screen>
  );
}
