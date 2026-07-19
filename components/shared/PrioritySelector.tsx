import { Label, Tabs } from 'heroui-native';
import { View } from 'react-native';

import { Priority } from '@/lib/reminderIntervals';

export type { Priority };

type PrioritySelectorProps = {
  value: Priority;
  onChange: (value: Priority) => void;
};

const OPTIONS: { value: Priority; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'FLEXIBLE', label: 'Flexible' },
];

// The priority selector — a segmented control (one shared track, a single sliding
// indicator, no per-option fill colour), the same shape as the Month/Week toggle on the
// Calendar screen. Built on heroui-native's Tabs rather than a styled RadioGroup — Tabs
// already animates the sliding indicator, no need to hand-roll that.
export function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  return (
    <View className="gap-1.5">
      <Label>Priority</Label>
      <Tabs value={value} onValueChange={(next) => onChange(next as Priority)}>
        <Tabs.List>
          <Tabs.Indicator />
          {OPTIONS.map((option) => (
            <Tabs.Trigger key={option.value} value={option.value}>
              <Tabs.Label>{option.label}</Tabs.Label>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
    </View>
  );
}
