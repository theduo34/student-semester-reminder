import { Text, View } from 'react-native';

// Profile, reminder timing rows, notification/calendar toggles, logout — built feature
// by feature.
export default function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-foreground">Settings</Text>
    </View>
  );
}
