import { Text, View } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

// Static, non-interactive placeholder for the Month/Week segmented control — wiring is
// a separate pass.
function ViewToggle() {
  return (
    <View className="flex-row items-center rounded-full bg-surface-secondary p-0.5">
      <View className="rounded-full bg-surface px-3 py-1">
        <Text className="text-xs font-medium text-foreground">Month</Text>
      </View>
      <View className="px-3 py-1">
        <Text className="text-xs font-medium text-muted">Week</Text>
      </View>
    </View>
  );
}

// Month/week toggle, day agenda — built feature by feature.
export default function CalendarScreen() {
  return (
    <Screen header={<AppTopBar title="Calendar" right={<ViewToggle />} />}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Calendar</Text>
      </View>
    </Screen>
  );
}
