import { useAuthActions } from '@convex-dev/auth/react';
import { Button } from 'heroui-native';
import { Text, View } from 'react-native';

import { AppTopBar } from '@/components/shared/AppTopBar';
import { Screen } from '@/components/ui/Screen';

// Profile, reminder timing rows, notification/calendar toggles — built feature by
// feature. Logout wired ahead of the rest since it's the only way back to (auth) for
// manual testing once signed in.
export default function SettingsScreen() {
  const { signOut } = useAuthActions();

  return (
    <Screen header={<AppTopBar title="Settings" />}>
      <View className="flex-1 items-center justify-center gap-4">
        <Text className="text-foreground">Settings</Text>
        <Button variant="danger-soft" onPress={() => signOut()}>
          <Button.Label>Log out</Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
