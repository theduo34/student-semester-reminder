import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Reserved for routing a tapped notification to /(protected)/activity/[entityId] once
// the notification payload shape (entityId/entityType) is defined alongside reminders.
export function useNotificationObserver() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      // TODO: navigate based on response.notification.request.content.data
    });
    return () => subscription.remove();
  }, []);
}
