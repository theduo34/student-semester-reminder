import { useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Checkbox, ListGroup, Separator, Skeleton, Spinner, useThemeColor } from 'heroui-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { useAppToast } from '@/hooks/use-app-toast';
import { INTERVAL_GROUPS, Priority } from '@/lib/reminderIntervals';
import { api } from '@/convex/_generated/api';

type PriorityParam = 'critical' | 'important' | 'flexible';

const PARAM_TO_PRIORITY: Record<PriorityParam, Priority> = {
  critical: 'CRITICAL',
  important: 'IMPORTANT',
  flexible: 'FLEXIBLE',
};

const PARAM_TO_TITLE: Record<PriorityParam, string> = {
  critical: 'Critical Reminders',
  important: 'Important Reminders',
  flexible: 'Flexible Reminders',
};

export default function ReminderTimingScreen() {
  const { priority: priorityParam } = useLocalSearchParams<{ priority: PriorityParam }>();
  const priority = PARAM_TO_PRIORITY[priorityParam];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useAppToast();
  const accent = useThemeColor('accent');

  const savedIntervals = useQuery(api.reminders.getPreferences, { priority });
  const setPreferences = useMutation(api.reminders.setPreferences);

  // Seeded once from the query, then diverges with local edits until Save — the
  // subscription staying live underneath must not stomp on unsaved in-progress checks.
  const [selectedMinutes, setSelectedMinutes] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (savedIntervals !== undefined && selectedMinutes === null) {
      setSelectedMinutes(new Set(savedIntervals));
    }
  }, [savedIntervals, selectedMinutes]);

  const [isSaving, setIsSaving] = useState(false);
  const hasChanges =
    selectedMinutes !== null &&
    savedIntervals !== undefined &&
    (selectedMinutes.size !== savedIntervals.length ||
      savedIntervals.some((minutes) => !selectedMinutes.has(minutes)));

  const toggleInterval = (minutes: number) => {
    setSelectedMinutes((current) => {
      const next = new Set(current);
      if (next.has(minutes)) {
        next.delete(minutes);
      } else {
        next.add(minutes);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedMinutes === null || !hasChanges) {
      return;
    }
    setIsSaving(true);
    try {
      await setPreferences({ priority, intervals: Array.from(selectedMinutes) });
      showSuccess('Reminder timing saved');
      router.back();
    } catch {
      showError('Could not save reminder timing');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: PARAM_TO_TITLE[priorityParam],
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={isSaving || !hasChanges}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Save">
              {isSaving ? (
                <Spinner color={accent} />
              ) : (
                <Text className={`font-bold text-accent ${!hasChanges ? 'opacity-40' : ''}`}>Save</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-6 px-4 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <PriorityBadge priority={priority} />

        <Text className="text-sm text-muted">
          Choose when you&apos;d like to be reminded before these activities are due.
        </Text>

        {selectedMinutes === null
          ? INTERVAL_GROUPS.map((group) => (
              <Skeleton key={group.title} className="h-32 w-full rounded-md" />
            ))
          : INTERVAL_GROUPS.map((group) =>
              group.options.length === 0 ? null : (
                <View key={group.title} className="gap-2">
                  <Text className="ml-2 text-xs font-semibold uppercase text-muted">{group.title}</Text>
                  <ListGroup className="rounded-md">
                    {group.options.map((option, index) => (
                      <View key={option.minutes}>
                        {index > 0 ? <Separator className="mx-4" /> : null}
                        <ListGroup.Item onPress={() => toggleInterval(option.minutes)}>
                          <ListGroup.ItemContent>
                            <ListGroup.ItemTitle>{option.label}</ListGroup.ItemTitle>
                          </ListGroup.ItemContent>
                          <ListGroup.ItemSuffix>
                            {/* pointerEvents="none" — the row itself (ListGroup.Item.onPress
                                above) is the one and only toggle target; without this the
                                Checkbox's own touch handling would swallow the tap and
                                toggle a second time. */}
                            <View pointerEvents="none">
                              <Checkbox isSelected={selectedMinutes.has(option.minutes)} />
                            </View>
                          </ListGroup.ItemSuffix>
                        </ListGroup.Item>
                      </View>
                    ))}
                  </ListGroup>
                </View>
              ),
            )}
      </ScrollView>
    </>
  );
}
