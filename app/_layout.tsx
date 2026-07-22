import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import '@/global.css';
import { SplashReveal } from '@/components/shared/SplashReveal';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { useAlertsSync } from '@/hooks/useAlertsSync';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotificationObserver } from '@/hooks/use-notification-observer';
import { usePushRegistration } from '@/hooks/usePushRegistration';
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
  usePushRegistration();
  const gate = useAuthGate();
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const mountedAtRef = useRef(Date.now());
  // undefined = native side hasn't answered yet, null = answered, nothing pending, a
  // response object = the app was opened via a tapped notification. See
  // hooks/use-auth-gate.ts for the parallel read of this same value that skips the
  // landing carousel for the same reason.
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (gate.status !== 'loading' && lastNotificationResponse !== undefined && !nativeSplashHidden) {
      setNativeSplashHidden(true);
      // Polish, not a loading gate (see CLAUDE.md's splash-reveal flow): a slow
      // network already made the student wait past the reveal's own ~700ms runtime,
      // so playing it on top of that wait would only add more waiting for nothing —
      // skip straight through instead of stacking a second delay. Same reasoning for a
      // notification-launched open: "notifications go directly into the app" means the
      // reveal doesn't play at all, regardless of how fast auth resolved.
      const elapsedMs = Date.now() - mountedAtRef.current;
      setShowReveal(elapsedMs <= 2000 && !lastNotificationResponse);
      SplashScreen.hideAsync();
    }
  }, [gate.status, lastNotificationResponse, nativeSplashHidden]);

  if (gate.status === 'loading') {
    return null;
  }

  return (
    <>
      <Stack>
        <Stack.Protected guard={gate.status === 'landing'}>
          <Stack.Screen name="(landing)" options={{ headerShown: false }} />
        </Stack.Protected>
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
        <Stack.Protected guard={gate.status === 'admin'}>
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
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
