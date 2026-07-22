import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/convex/_generated/api';
import { convex } from '@/lib/convexClient';

const PERMISSION_DENIED_KEY = 'termio.pushPermissionDenied';

export type PushChannel = 'critical' | 'important' | 'flexible';

// Mirrors the app's CRITICAL/IMPORTANT/FLEXIBLE priority tiers (see AGENTS.md's Push
// architecture section) — one channel vocabulary shared by push (here) and local
// reminder-fired scheduling once that's built (hooks/use-notification-observer.ts is
// still a stub), not two separately-invented groupings.
const CHANNEL_IMPORTANCE: Record<PushChannel, Notifications.AndroidImportance> = {
  critical: Notifications.AndroidImportance.MAX,
  important: Notifications.AndroidImportance.HIGH,
  flexible: Notifications.AndroidImportance.DEFAULT,
};

// setNotificationChannelAsync resolves to null on platforms without channel support
// rather than throwing, so this runs unconditionally cross-platform — no Platform.OS
// branch needed here.
async function ensureNotificationChannels(): Promise<void> {
  await Promise.all(
    (Object.keys(CHANNEL_IMPORTANCE) as PushChannel[]).map((channelId) =>
      Notifications.setNotificationChannelAsync(channelId, {
        name: `${channelId.charAt(0).toUpperCase()}${channelId.slice(1)}`,
        importance: CHANNEL_IMPORTANCE[channelId],
      }),
    ),
  );
}

// The one intentional platform boundary in this file — push is meaningless outside a
// native device (this feature is "Android + iOS," not "Android + iOS + web"), not a
// behavior fork between the two; everything below this point runs identically on both.
function isPushCapablePlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function hasPreviouslyDeniedPermission(): Promise<boolean> {
  return (await AsyncStorage.getItem(PERMISSION_DENIED_KEY)) === 'true';
}

async function recordPermissionDenied(): Promise<void> {
  await AsyncStorage.setItem(PERMISSION_DENIED_KEY, 'true');
}

async function getExpoPushToken(): Promise<string | null> {
  if (!isPushCapablePlatform()) {
    return null;
  }

  let settings = await Notifications.getPermissionsAsync();

  if (!settings.granted) {
    if (await hasPreviouslyDeniedPermission()) {
      // Already said no — respect it rather than re-prompting on every launch. iOS
      // already refuses to re-show its own system prompt after one denial; Android
      // will actually let us ask again (canAskAgain stays true there), so this flag is
      // what makes "don't nag" an intentional app decision rather than an accident of
      // which OS the student happens to be on.
      return null;
    }
    if (!settings.canAskAgain) {
      await recordPermissionDenied();
      return null;
    }
    settings = await Notifications.requestPermissionsAsync();
    if (!settings.granted) {
      await recordPermissionDenied();
      return null;
    }
  }

  await ensureNotificationChannels();

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId configured (app.json extra.eas.projectId) — skipping token fetch.');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    // Expected on iOS until Apple Developer/APNs credentials are provisioned (see
    // AGENTS.md's Push architecture section) — this is the one place that gap
    // surfaces, handled by falling back to null, never a crash or a blocked login.
    // Android should succeed here as soon as a development/preview build (not Expo Go,
    // which doesn't support push at all) is installed.
    console.warn('[push] getExpoPushTokenAsync failed', error);
    return null;
  }
}

let registeredToken: string | null = null;

// Called by hooks/usePushRegistration.ts once auth resolves, and again whenever the
// token-rotation listener fires. Calls the Convex mutation directly via the shared
// client instance (convex.mutation), not useMutation — this also needs to run from the
// rotation listener's callback and could run outside any component, neither of which
// are React render contexts a hook could attach to.
export async function registerCurrentDeviceToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token || token === registeredToken) {
    return;
  }
  registeredToken = token;
  await convex.mutation(api.pushTokens.registerPushToken, {
    token,
    platform: Platform.OS as 'ios' | 'android',
  });
}

// Called from Settings' logout confirmation, BEFORE signOut() — see
// app/(protected)/(tabs)/settings/index.tsx. This has to run before the auth session
// clears, not react to it having cleared: unregisterPushToken is an authenticated
// mutation, so calling it after signOut() resolves would already be unauthenticated.
// That's why this isn't wired as a useEffect cleanup keyed on auth state — cleanup
// order can guarantee "eventually after," never "before."
export async function unregisterCurrentDeviceToken(): Promise<void> {
  if (!registeredToken) {
    return;
  }
  const token = registeredToken;
  registeredToken = null;
  try {
    await convex.mutation(api.pushTokens.unregisterPushToken, { token });
  } catch (error) {
    console.warn('[push] unregisterPushToken failed', error);
  }
}
