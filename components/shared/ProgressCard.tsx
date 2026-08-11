import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { IconSymbol } from '@/components/ui/icon-symbol';

export type ProgressCardProps = {
  /** Small line above the title — e.g. an institution name on the admin Dashboard.
   * Home doesn't set this; the semester title alone is enough context there. */
  eyebrow?: string;
  title: string;
  percent: number;
  weeksRemaining: number;
  /** Trailing label + chevron.right row, wired to whatever tapping the whole card (a
   * Pressable the caller wraps this in) navigates to — plain text, no baked-in arrow
   * character in the string itself, the icon is the arrow. Omit entirely when the
   * card isn't itself a link to somewhere new (the Semester Overview screen's own
   * use — you're already looking at the destination). */
  caption?: string;
};

// The one semester time-elapsed card — extracted from the student Home tab once the
// admin Dashboard needed the exact same accent-filled progress banner (see AGENTS.md's
// "never copy component code between two screens" rule). Both callers wrap this in
// their own Pressable for navigation; this component only renders the card itself.
export function ProgressCard({ eyebrow, title, percent, weeksRemaining, caption }: ProgressCardProps) {
  const [accentForeground] = useCSSVariable(['--accent-foreground']) as [string];

  return (
    <View className="gap-3 rounded-md bg-accent p-4">
      {eyebrow ? <Text className="text-xs font-medium text-accent-foreground/70">{eyebrow}</Text> : null}
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-medium text-accent-foreground">{title}</Text>
        <Text className="text-base font-medium text-accent-foreground">{percent}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-accent-foreground/20">
        <View className="h-2 rounded-full bg-accent-foreground" style={{ width: `${percent}%` }} />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-accent-foreground/80">{weeksRemaining} weeks remaining</Text>
        {caption ? (
          <View className="flex-row items-center gap-1">
            <Text className="text-xs font-medium text-accent-foreground/80">{caption}</Text>
            <IconSymbol name="chevron.right" size={12} color={accentForeground} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
