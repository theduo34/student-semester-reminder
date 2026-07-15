import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import '@/global.css';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotificationObserver } from '@/hooks/use-notification-observer';
import { convex, secureStorage } from '@/lib/convexClient';

// TODO: once auth + onboarding are built, gate which top-level group renders
// ((auth) vs (onboarding) vs (protected)) on isAuthenticated / semester-published state
// here instead of registering all three as plain Stack screens.
export const unstable_settings = {
  anchor: '(protected)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useNotificationObserver();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexAuthProvider client={convex} storage={secureStorage}>
        <HeroUINativeProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
              <Stack.Screen name="(protected)" options={{ headerShown: false }} />
              <Stack.Screen
                name="add-activity"
                options={{ presentation: 'modal', headerShown: false }}
              />
              <Stack.Screen
                name="edit-activity/[entityId]"
                options={{ presentation: 'modal', headerShown: false }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </HeroUINativeProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}
