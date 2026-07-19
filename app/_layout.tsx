import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import '@/global.css';
import { SplashReveal } from '@/components/shared/SplashReveal';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { useAlertsSync } from '@/hooks/useAlertsSync';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotificationObserver } from '@/hooks/use-notification-observer';
import { authStorage } from '@/lib/authStorage';
import { convex } from '@/lib/convexClient';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ConvexAuthProvider client={convex} storage={authStorage}>
          <HeroUINativeProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <RootNavigator />
              <StatusBar style="auto" />
            </ThemeProvider>
          </HeroUINativeProvider>
        </ConvexAuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  useNotificationObserver();
  useAlertsSync();
  const gate = useAuthGate();
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    if (gate.status !== 'loading' && !nativeSplashHidden) {
      setNativeSplashHidden(true);
      setShowReveal(true);
      SplashScreen.hideAsync();
    }
  }, [gate.status, nativeSplashHidden]);

  if (gate.status === 'loading') {
    return null;
  }

  return (
    <>
      <Stack>
        <Stack.Protected
          guard={gate.status === 'unauthenticated' || gate.status === 'unverified'}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected
          guard={gate.status === 'needsProfile' || gate.status === 'onboarding'}>
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={gate.status === 'ready'}>
          <Stack.Screen name="(protected)" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* fullScreenModal (not 'modal') — the New/Edit Reminder forms read as their own
            full screen, not an inset card peeking at what's behind it; ModalHeader's
            X/plus already gives them a "screen you close" feel, this makes the
            presentation match. iOS: true full-screen (UIModalPresentationFullScreen),
            no swipe-to-dismiss — closing is the X button only, same as edit-academic-
            details' own ConfirmDialog-gated close. Android's 'modal' was already
            effectively full-height, so this is a no-op there. */}
        <Stack.Screen
          name="add-activity"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="edit-activity/[entityId]"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen name="about" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen
          name="edit-academic-details"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
      {showReveal && <SplashReveal onFinish={() => setShowReveal(false)} />}
    </>
  );
}
