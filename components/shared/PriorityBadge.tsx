import { Text, View } from 'react-native';

import { Priority } from '@/lib/reminderIntervals';

const BADGE: Record<Priority, { label: string; bg: string; text: string }> = {
  CRITICAL: { label: 'Critical', bg: 'bg-critical', text: 'text-critical-foreground' },
  IMPORTANT: { label: 'Important', bg: 'bg-important', text: 'text-important-foreground' },
  FLEXIBLE: { label: 'Flexible', bg: 'bg-flexible', text: 'text-flexible-foreground' },
};

// The one priority badge — pill background + uppercase label from the priority tokens
// in global.css. First built for the reminder-timing screen, reused on Activity
// Details' hero row rather than a second copy of the same style map. Always reflects an
// activity's real stored/domain priority (courseActivity/personalReminder's own
// priority field, or CRITICAL by domain rule for a semesterActivity) — not the same
// thing as Calendar's dot-legend "Personal" bucket, which is a UI-only grouping for that
// one screen's simplified marking system (see AGENTS.md), never a fourth badge value
// here.
export function PriorityBadge({ priority }: { priority: Priority }) {
  const badge = BADGE[priority];
  return (
    <View className={`self-start rounded-full px-3 py-1 ${badge.bg}`}>
      <Text className={`text-xs font-semibold uppercase ${badge.text}`}>{badge.label}</Text>
    </View>
  );
}
