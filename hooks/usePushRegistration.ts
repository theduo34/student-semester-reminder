import { useConvexAuth } from 'convex/react';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { registerCurrentDeviceToken } from '@/lib/pushNotifications';

// Registers this device's push token once auth resolves, and keeps it fresh across the
// rare token-rotation event — see lib/pushNotifications.ts for the registration/
// permission logic itself, this hook is just the lifecycle wiring. Called once from the
// root layout, same pattern as useAlertsSync/useNotificationObserver, not per-screen.
// Unregistering on logout is handled separately, at the point of the sign-out call
// itself — see lib/pushNotifications.ts#unregisterCurrentDeviceToken's own note on why
// that can't just be this hook's effect cleanup.
export function usePushRegistration() {
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    registerCurrentDeviceToken();

    const subscription = Notifications.addPushTokenListener(() => {
      // The event payload is the raw device token (FCM/APNs), not the Expo token our
      // backend stores — re-derive the Expo token from it rather than trying to
      // convert the native token ourselves.
      registerCurrentDeviceToken();
    });
    return () => subscription.remove();
  }, [isAuthenticated]);
}
