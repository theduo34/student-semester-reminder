import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { ENTITY_TYPE_TO_ROUTE_TYPE } from '@/lib/entityRouting';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type PushData = { entityType: Doc<'alerts'>['entityType']; entityId: string };

function isPushData(data: unknown): data is PushData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as PushData).entityType === 'string' &&
    typeof (data as PushData).entityId === 'string'
  );
}

// The only two kinds this app ever sends real push for (see AGENTS.md's Push
// architecture section: reminder_fired stays local, never pushed). semesterActivities
// only ever appear as NEW_EVENT and courseActivities/personalReminders only ever appear
// as OVERDUE, so the kind needed for alerts.markReadByEntity's lookup is fully
// determined by entityType, without adding a third payload field beyond the
// entityType/entityId convention shared with local notifications. If a kind ever
// becomes push-able from more than one entityType, this derivation stops being valid —
// flagged here so it's not silently wrong later.
function kindForEntityType(entityType: Doc<'alerts'>['entityType']): Doc<'alerts'>['kind'] {
  return entityType === 'semesterActivities' ? 'NEW_EVENT' : 'OVERDUE';
}

// Handles a tapped notification — local (once local scheduling exists, see
// hooks/use-notification-observer.ts's own historical TODO) or real push (new_event,
// overdue), both carry the same {entityType, entityId} data shape, so one handler
// covers both. Called once from the root layout, never per-screen.
export function useNotificationObserver() {
  const router = useRouter();
  const markReadByEntity = useMutation(api.alerts.markReadByEntity);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (!isPushData(data)) {
        return;
      }
      markReadByEntity({ entityId: data.entityId, kind: kindForEntityType(data.entityType) }).catch(() => undefined);
      router.push({
        pathname: '/activity/[entityId]',
        params: { entityId: data.entityId, type: ENTITY_TYPE_TO_ROUTE_TYPE[data.entityType] },
      });
    };

    // Per expo-notifications' own documented behavior, this listener also replays the
    // response that cold-launched the app once it's attached — no separate
    // getLastNotificationResponseAsync call needed here for that case (the root
    // layout's own useLastNotificationResponse() is a parallel, render-time read of
    // the same underlying value, used only to decide whether to skip the splash
    // reveal animation — see app/_layout.tsx).
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [markReadByEntity, router]);
}
