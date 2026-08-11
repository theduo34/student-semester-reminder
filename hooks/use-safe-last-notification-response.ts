import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// expo-notifications' useLastNotificationResponse throws ("not available on web")
// rather than resolving to null like most of the library's web shims do — confirmed
// by hitting it directly while testing the admin web target. Platform.OS is a static,
// session-long constant (never toggles at runtime), so branching on it before the
// hook call is safe despite reading like conditional hook usage; the branch taken
// never actually changes across renders. Shared by app/_layout.tsx and
// hooks/use-auth-gate.ts, which both read this same value for the same reason (skip
// the splash reveal / the landing gate on a notification-tap cold launch — a concept
// that doesn't exist on web).
export function useSafeLastNotificationResponse() {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return null;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return Notifications.useLastNotificationResponse();
}
