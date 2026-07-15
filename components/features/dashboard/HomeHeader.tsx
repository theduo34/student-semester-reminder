import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEADER_CONTENT_HEIGHT, SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';

export type HomeHeaderProps = {
  date: string;
  name: string;
  avatarInitials: string;
};

/**
 * Home's header slot — same full-bleed bg-surface + safe-area treatment as AppTopBar
 * (components/shared/AppTopBar.tsx), and the same HEADER_CONTENT_HEIGHT, so Home's
 * header is the same height as every other screen's even though it carries two lines
 * of text plus an avatar instead of a single title. HEADER_CONTENT_HEIGHT is sized to
 * fit this content at a legible size, rather than shrinking the type to fit a shorter
 * bar. Kept as its own component rather than folded into AppTopBar: no left/right
 * action slots, structurally different content. Passed as Screen's `header` prop.
 * Static/placeholder data only at this stage — no auth wiring yet.
 */
export function HomeHeader({ date, name, avatarInitials }: HomeHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="border-b border-border bg-surface" style={{ paddingTop: insets.top }}>
      <View
        className="flex-row items-center justify-between"
        style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING, height: HEADER_CONTENT_HEIGHT }}>
        <View className="gap-0.5">
          <Text className="text-sm text-muted">{date}</Text>
          <Text className="text-xl font-bold text-foreground">Hello, {name}</Text>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-secondary">
          <Text className="text-base font-medium text-surface-secondary-foreground">
            {avatarInitials}
          </Text>
        </View>
      </View>
    </View>
  );
}
