import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Card, ListGroup, Separator, Skeleton, Switch, useThemeColor } from 'heroui-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/shared/Avatar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AppTopBar } from '@/components/shared/AppTopBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';
import { useAppToast } from '@/hooks/use-app-toast';
import { unregisterCurrentDeviceToken } from '@/lib/pushNotifications';
import { formatIntervalsSummary } from '@/lib/reminderIntervals';

const PRIORITY_ROWS = [
  { param: 'critical', label: 'Critical activities', dotClassName: 'bg-critical' },
  { param: 'important', label: 'Important activities', dotClassName: 'bg-important' },
  { param: 'flexible', label: 'Flexible activities', dotClassName: 'bg-flexible' },
] as const;

// First protected screen built with real logic — establishes the patterns every other
// protected screen inherits (see CLAUDE.md): detail screens pushed onto the parent
// Stack rather than nested in tabs, ConfirmDialog for destructive confirmations instead
// of Alert.alert, and skeletons-for-fetch / inline-loading-for-mutations as the only two
// loading treatments. The profile card is deliberately minimal (avatar, name, joined
// date only) — everything else about the student lives on the profile detail screen,
// not duplicated here.
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { showError } = useAppToast();
  const muted = useThemeColor('muted');

  const viewer = useQuery(api.users.viewer);
  const criticalIntervals = useQuery(api.reminders.getPreferences, { priority: 'CRITICAL' });
  const importantIntervals = useQuery(api.reminders.getPreferences, { priority: 'IMPORTANT' });
  const flexibleIntervals = useQuery(api.reminders.getPreferences, { priority: 'FLEXIBLE' });
  const intervalsByParam: Record<(typeof PRIORITY_ROWS)[number]['param'], number[] | undefined> = {
    critical: criticalIntervals,
    important: importantIntervals,
    flexible: flexibleIntervals,
  };

  const notificationPreferences = useQuery(api.notificationPreferences.getPreferences);
  const setNotificationPreferences = useMutation(
    api.notificationPreferences.setPreferences,
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.notificationPreferences.getPreferences, {});
    if (current !== undefined) {
      localStore.setQuery(api.notificationPreferences.getPreferences, {}, { ...current, ...args });
    }
  });

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const isLoading =
    viewer === undefined ||
    criticalIntervals === undefined ||
    importantIntervals === undefined ||
    flexibleIntervals === undefined ||
    notificationPreferences === undefined;

  const toggleNotificationPreference = async (
    key: 'pushEnabled' | 'soundEnabled' | 'calendarSyncEnabled',
    value: boolean,
  ) => {
    try {
      await setNotificationPreferences({ [key]: value });
    } catch {
      showError('Could not save that setting');
    }
  };

  const joinedDate = viewer
    ? new Date(viewer._creationTime).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : '';

  return (
    <Screen header={<AppTopBar title="Settings" />} className="pt-4">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-6 pb-10">
        {isLoading ? (
          <SettingsSkeleton />
        ) : (
          <>
            <Pressable onPress={() => router.push('/settings/profile')}>
              <Card className="rounded-md">
                <Card.Body className="flex-row items-center gap-4">
                  <Avatar name={viewer?.name ?? ''} size="md" />
                  <View className="flex-1 gap-0.5">
                    <Card.Title>{viewer?.name ?? 'Student'}</Card.Title>
                    <View className="flex-row items-center gap-1">
                      <IconSymbol name="calendar" size={12} color={muted} />
                      <Text className="text-sm text-muted">Joined {joinedDate}</Text>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={muted} />
                </Card.Body>
              </Card>
            </Pressable>

            <View className="gap-2">
              <Text className="ml-2 text-sm text-muted">Reminder timing</Text>
              <ListGroup className="rounded-md">
                {PRIORITY_ROWS.map((row, index) => (
                  <View key={row.param}>
                    {index > 0 ? <Separator className="mx-4" /> : null}
                    <ListGroup.Item
                      onPress={() =>
                        router.push({
                          pathname: '/settings/reminder-timing/[priority]',
                          params: { priority: row.param },
                        })
                      }>
                      <ListGroup.ItemPrefix>
                        <View className={`size-2.5 rounded-full ${row.dotClassName}`} />
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>{row.label}</ListGroup.ItemTitle>
                        <ListGroup.ItemDescription>
                          {formatIntervalsSummary(intervalsByParam[row.param] ?? [])}
                        </ListGroup.ItemDescription>
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix />
                    </ListGroup.Item>
                  </View>
                ))}
              </ListGroup>
            </View>

            <View className="gap-2">
              <Text className="ml-2 text-sm text-muted">Notifications</Text>
              <ListGroup className="rounded-md">
                <ListGroup.Item disabled>
                  <ListGroup.ItemPrefix>
                    <IconSymbol name="bell" size={20} color={muted} />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>Push notifications</ListGroup.ItemTitle>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <Switch
                      isSelected={notificationPreferences?.pushEnabled ?? true}
                      onSelectedChange={(value) => toggleNotificationPreference('pushEnabled', value)}
                    />
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
                <Separator className="mx-4" />
                <ListGroup.Item disabled>
                  <ListGroup.ItemPrefix>
                    <IconSymbol name="speaker.wave.2" size={20} color={muted} />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>Notification sound</ListGroup.ItemTitle>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <Switch
                      isSelected={notificationPreferences?.soundEnabled ?? true}
                      onSelectedChange={(value) => toggleNotificationPreference('soundEnabled', value)}
                    />
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
              </ListGroup>
            </View>

            <View className="gap-2">
              <Text className="ml-2 text-sm text-muted">Calendar</Text>
              <ListGroup className="rounded-md">
                <ListGroup.Item disabled>
                  <ListGroup.ItemPrefix>
                    <IconSymbol name="calendar" size={20} color={muted} />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>Sync to device calendar</ListGroup.ItemTitle>
                    <ListGroup.ItemDescription>
                      Add reminders to your phone&apos;s calendar
                    </ListGroup.ItemDescription>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <Switch
                      isSelected={notificationPreferences?.calendarSyncEnabled ?? false}
                      onSelectedChange={(value) =>
                        toggleNotificationPreference('calendarSyncEnabled', value)
                      }
                    />
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
              </ListGroup>
            </View>

            <ListGroup className="rounded-md">
              <ListGroup.Item onPress={() => router.push('/about')}>
                <ListGroup.ItemPrefix>
                  <IconSymbol name="info.circle" size={20} color={muted} />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>About & version</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            </ListGroup>

            <Pressable
              onPress={() => setIsLogoutDialogOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              className="items-center py-4">
              <Text className="font-medium text-danger">Log out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        isOpen={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        title="Log out of Termio?"
        message="You'll need to log in again to see your reminders."
        confirmLabel="Log out"
        onConfirm={async () => {
          try {
            // Before signOut(), not after — unregisterPushToken is an authenticated
            // mutation, so it has to run while the session is still valid. This
            // prevents this device's push from landing on whichever different account
            // logs in here next (see lib/pushNotifications.ts).
            await unregisterCurrentDeviceToken();
            await signOut();
          } catch {
            showError('Could not log out — try again');
            throw new Error('sign out failed');
          }
        }}
      />
    </Screen>
  );
}

function SettingsSkeleton() {
  return (
    <View className="gap-6">
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-44 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-14 w-full rounded-md" />
    </View>
  );
}
