import { Text, View } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

// Static text placeholder — not wired to a mark-all-read action yet.
function MarkAllReadLink() {
  return <Text className="text-sm font-medium text-accent">Mark all read</Text>;
}

// Notifications feed — built feature by feature.
export default function AlertsScreen() {
  return (
    <Screen header={<AppTopBar title="Alerts" right={<MarkAllReadLink />} />}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Alerts</Text>
      </View>
    </Screen>
  );
}
