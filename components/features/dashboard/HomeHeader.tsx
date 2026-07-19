import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/shared/Avatar';
import { HEADER_CONTENT_HEIGHT, SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';

export type HomeHeaderProps = {
  date: string;
  name: string;
  /** Also drives the avatar's initials and colour (see components/shared/Avatar.tsx) — pass the full name, not a pre-shortened greeting name. */
  fullName: string;
  onAvatarPress: () => void;
};

/**
 * Home's header slot — same full-bleed bg-surface + safe-area treatment as AppTopBar
 * (components/shared/AppTopBar.tsx), and the same HEADER_CONTENT_HEIGHT, so Home's
 * header is the same height as every other screen's even though it carries two lines
 * of text plus an avatar instead of a single title. HEADER_CONTENT_HEIGHT is sized to
 * fit this content at a legible size, rather than shrinking the type to fit a shorter
 * bar. Kept as its own component rather than folded into AppTopBar: no left/right
 * action slots, structurally different content. Passed as Screen's `header` prop.
 * Avatar is tappable — shortcut to the profile detail screen, the same one reachable
 * from Settings > Profile card.
 */
export function HomeHeader({ date, name, fullName, onAvatarPress }: HomeHeaderProps) {
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
        <Pressable onPress={onAvatarPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open profile">
          <Avatar name={fullName} size="md" />
        </Pressable>
      </View>
    </View>
  );
}
