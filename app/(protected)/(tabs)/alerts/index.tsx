import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Skeleton, useThemeColor } from 'heroui-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AlertCard } from '@/components/features/alerts/AlertCard';
import { ActionSheet } from '@/components/shared/ActionSheet';
import { AppTopBar } from '@/components/shared/AppTopBar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useAppToast } from '@/hooks/use-app-toast';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

type AlertRow = Doc<'alerts'>;

const BUCKET_LABELS = ['TODAY', 'YESTERDAY', 'THIS WEEK', 'EARLIER'] as const;

// Today >= start of today; Yesterday >= start of yesterday and < today; This week >=
// 7 days back and < yesterday; Earlier is everything else. A bucket with zero alerts
// is dropped entirely — no empty "TODAY" header sitting above nothing.
function bucketAlerts(alerts: AlertRow[]): { label: (typeof BUCKET_LABELS)[number]; items: AlertRow[] }[] {
  const now = Date.now();
  const startToday = startOfLocalDay(now);
  const startYesterday = startToday - DAY_MS;
  const startWeek = startToday - 7 * DAY_MS;

  const buckets: Record<(typeof BUCKET_LABELS)[number], AlertRow[]> = {
    TODAY: [],
    YESTERDAY: [],
    'THIS WEEK': [],
    EARLIER: [],
  };
  for (const alert of alerts) {
    if (alert.createdAt >= startToday) buckets.TODAY.push(alert);
    else if (alert.createdAt >= startYesterday) buckets.YESTERDAY.push(alert);
    else if (alert.createdAt >= startWeek) buckets['THIS WEEK'].push(alert);
    else buckets.EARLIER.push(alert);
  }
  return BUCKET_LABELS.map((label) => ({ label, items: buckets[label] })).filter((bucket) => bucket.items.length > 0);
}

const ENTITY_TYPE_TO_ROUTE_TYPE: Record<AlertRow['entityType'], 'course' | 'semester' | 'personal'> = {
  courseActivities: 'course',
  semesterActivities: 'semester',
  personalReminders: 'personal',
};

// Alerts feed — a client-derived log (see AGENTS.md's Alerts feed section), not real OS
// push notifications. Rows are written centrally by hooks/useAlertsSync.ts (wired at
// the root layout); this screen only reads/manages them.
export default function AlertsScreen() {
  const router = useRouter();
  const { showError } = useAppToast();
  const muted = useThemeColor('muted');
  const accent = useThemeColor('accent');
  const accentSoft = useThemeColor('accent-soft');

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const alerts = useQuery(api.alerts.listMine);

  const markRead = useMutation(api.alerts.markRead).withOptimisticUpdate((localStore, { alertId }) => {
    const current = localStore.getQuery(api.alerts.listMine, {});
    if (current) {
      localStore.setQuery(
        api.alerts.listMine,
        {},
        current.map((alert) => (alert._id === alertId ? { ...alert, isRead: true } : alert)),
      );
    }
  });
  const markAllRead = useMutation(api.alerts.markAllRead).withOptimisticUpdate((localStore) => {
    const current = localStore.getQuery(api.alerts.listMine, {});
    if (current) {
      localStore.setQuery(
        api.alerts.listMine,
        {},
        current.map((alert) => ({ ...alert, isRead: true })),
      );
    }
  });
  const removeAlert = useMutation(api.alerts.remove).withOptimisticUpdate((localStore, { alertId }) => {
    const current = localStore.getQuery(api.alerts.listMine, {});
    if (current) {
      localStore.setQuery(api.alerts.listMine, {}, current.filter((alert) => alert._id !== alertId));
    }
  });
  const removeAll = useMutation(api.alerts.removeAll).withOptimisticUpdate((localStore) => {
    localStore.setQuery(api.alerts.listMine, {}, []);
  });

  const unreadCount = useMemo(() => alerts?.filter((alert) => !alert.isRead).length ?? 0, [alerts]);
  const buckets = useMemo(() => bucketAlerts(alerts ?? []), [alerts]);

  const handlePressAlert = (alert: AlertRow) => {
    if (!alert.isRead) {
      markRead({ alertId: alert._id }).catch(() => undefined);
    }
    router.push({
      pathname: '/activity/[entityId]',
      params: { entityId: alert.entityId, type: ENTITY_TYPE_TO_ROUTE_TYPE[alert.entityType] },
    });
  };

  const handleDeleteAlert = async (alertId: Id<'alerts'>) => {
    try {
      await removeAlert({ alertId });
    } catch {
      showError('Could not delete — try again');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead({});
    } catch {
      showError('Could not update — try again');
    }
  };

  const menu = (
    <ActionSheet
      trigger={
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Alerts menu"
          style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, backgroundColor: 'transparent' })}>
          <IconSymbol name="ellipsis" color={muted} size={20} />
        </Pressable>
      }
      actions={[
        {
          key: 'clear',
          label: 'Clear all alerts',
          icon: 'trash',
          variant: 'danger',
          isDisabled: (alerts?.length ?? 0) === 0,
          onSelect: () => setIsClearDialogOpen(true),
        },
      ]}
    />
  );

  const right = (
    <View className="flex-row items-center gap-4">
      <Pressable onPress={handleMarkAllRead} disabled={unreadCount === 0} hitSlop={8}>
        <Text className={`text-sm font-medium ${unreadCount === 0 ? 'text-muted' : 'text-accent'}`}>Mark all read</Text>
      </Pressable>
      {menu}
    </View>
  );

  return (
    <Screen header={<AppTopBar title="Alerts" right={right} />}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="gap-6 pb-10 pt-4">
        {alerts === undefined ? (
          <AlertsSkeleton />
        ) : alerts.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3 px-6 py-16">
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 80, height: 80, backgroundColor: accentSoft }}>
              <IconSymbol name="bell" size={32} color={accent} />
            </View>
            <Text className="text-center text-lg font-bold text-foreground">You&apos;re all up to date</Text>
            <Text className="text-center text-sm text-muted">
              New alerts will land here when reminders fire or your admin publishes an event.
            </Text>
          </View>
        ) : (
          buckets.map((bucket) => (
            <View key={bucket.label} className="gap-3">
              <Text className="text-xs font-semibold tracking-wide text-muted">{bucket.label}</Text>
              <View className="gap-2">
                {bucket.items.map((alert) => (
                  <AlertCard
                    key={alert._id}
                    kind={alert.kind}
                    priority={alert.priority}
                    title={alert.title}
                    subtitle={alert.subtitle}
                    createdAt={alert.createdAt}
                    isRead={alert.isRead}
                    onPress={() => handlePressAlert(alert)}
                    onDelete={() => handleDeleteAlert(alert._id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        isOpen={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        title="Clear all alerts?"
        message="This can't be undone."
        confirmLabel="Clear all"
        onConfirm={async () => {
          try {
            await removeAll({});
          } catch {
            showError('Could not clear alerts — try again');
            throw new Error('clear failed');
          }
        }}
      />
    </Screen>
  );
}

function AlertsSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-4 w-16 rounded-md" />
      <View className="gap-2">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </View>
    </View>
  );
}
