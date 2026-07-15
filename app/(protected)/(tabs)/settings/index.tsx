import { Text, View } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

// Profile, reminder timing rows, notification/calendar toggles, logout — built feature
// by feature.
export default function SettingsScreen() {
  return (
    <Screen header={<AppTopBar title="Settings" />}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Settings</Text>
      </View>
    </Screen>
  );
}
