import { Swipeable } from 'react-native-gesture-handler';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

export type AlertKind = 'REMINDER_FIRED' | 'NEW_EVENT' | 'OVERDUE';

export type AlertCardProps = {
  kind: AlertKind;
  /** Only meaningful for kind === 'REMINDER_FIRED' — the underlying activity's real priority, which colours the icon well. Ignored for the other two kinds (NEW_EVENT/OVERDUE have their own fixed colour, not priority-driven). */
  priority?: 'CRITICAL' | 'IMPORTANT' | 'FLEXIBLE';
  title: string;
  subtitle: string;
  createdAt: number;
  isRead: boolean;
  onPress: () => void;
  onDelete: () => void;
};

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatTimestamp(ms: number): string {
  const isToday = startOfLocalDay(ms) === startOfLocalDay(Date.now());
  return isToday
    ? new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const KIND_ICON: Record<AlertKind, IconSymbolName> = {
  REMINDER_FIRED: 'bell',
  NEW_EVENT: 'graduationcap.fill',
  OVERDUE: 'exclamationmark.circle.fill',
};

// The one Alerts-feed row. Swipe-to-reveal-delete via react-native-gesture-handler's
// Swipeable (already a project dependency, no new library needed) — the standing
// pattern for list-item dismissal in this app going forward: no ConfirmDialog for a
// single-item delete on a low-stakes list like this one, that's reserved for bulk/
// high-stakes actions (see the Alerts screen's "Clear all" for the bulk case, which
// does use it).
export function AlertCard({ kind, priority, title, subtitle, createdAt, isRead, onPress, onDelete }: AlertCardProps) {
  const [criticalForeground, importantForeground, flexibleForeground, accent] = useCSSVariable([
    '--critical-foreground',
    '--important-foreground',
    '--flexible-foreground',
    '--accent',
  ]) as string[];

  const { wellBgClassName, iconColor } = (() => {
    if (kind === 'OVERDUE') return { wellBgClassName: 'bg-critical/15', iconColor: criticalForeground };
    if (kind === 'NEW_EVENT') return { wellBgClassName: 'bg-accent/15', iconColor: accent };
    // REMINDER_FIRED — coloured by the underlying activity's real priority.
    if (priority === 'IMPORTANT') return { wellBgClassName: 'bg-important/15', iconColor: importantForeground };
    if (priority === 'FLEXIBLE') return { wellBgClassName: 'bg-flexible/15', iconColor: flexibleForeground };
    return { wellBgClassName: 'bg-critical/15', iconColor: criticalForeground };
  })();

  return (
    <Animated.View exiting={FadeOut.duration(200)}>
      <Swipeable
        friction={2}
        rightThreshold={56}
        overshootRight={false}
        onSwipeableOpen={onDelete}
        renderRightActions={() => (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete alert"
            className="ml-2 w-24 items-center justify-center gap-1 rounded-md bg-critical">
            <IconSymbol name="trash" size={18} color={criticalForeground} />
            <Text className="text-xs font-medium text-critical-foreground">Delete</Text>
          </Pressable>
        )}>
        <Pressable
          onPress={onPress}
          className={`relative flex-row items-center gap-3 rounded-md border p-3 ${
            isRead ? 'border-border bg-surface' : 'border-accent/25 bg-accent/5'
          }`}>
          {!isRead ? <View className="absolute right-2 top-2 size-2 rounded-full bg-accent" /> : null}

          <View className={`size-[34px] shrink-0 items-center justify-center rounded-md ${wellBgClassName}`}>
            <IconSymbol name={KIND_ICON[kind]} size={17} color={iconColor} />
          </View>

          <View className="min-w-0 flex-1 gap-0.5 pr-3">
            <Text numberOfLines={1} className="text-[13px] font-medium text-foreground">
              {title}
            </Text>
            <Text numberOfLines={1} className="text-[12px] text-muted">
              {subtitle}
            </Text>
            <Text className="text-[10.5px] text-muted/70">{formatTimestamp(createdAt)}</Text>
          </View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}
