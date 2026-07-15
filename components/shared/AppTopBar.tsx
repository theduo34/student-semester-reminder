import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { HEADER_CONTENT_HEIGHT, SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';

export type AppTopBarProps = {
  left?: 'back' | 'close' | ReactNode;
  title: string;
  titleVariant?: 'default' | 'muted';
  right?: ReactNode;
};

// Both variants are semibold per the design — muted only differs in size/color, not
// weight.
const TITLE_CLASSES: Record<NonNullable<AppTopBarProps['titleVariant']>, string> = {
  default: 'text-lg font-bold text-foreground',
  muted: 'text-base font-bold text-muted',
};


export function AppTopBar({ left, title, titleVariant = 'default', right }: AppTopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [foreground] = useCSSVariable(['--foreground']) as [string];

  let leftElement: ReactNode = null;
  if (left === 'back') {
    leftElement = (
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <IconSymbol name="chevron.left" color={foreground} size={22} />
      </Pressable>
    );
  } else if (left === 'close') {
    leftElement = (
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close">
        <IconSymbol name="xmark" color={foreground} size={20} />
      </Pressable>
    );
  } else if (left) {
    leftElement = left;
  }

  return (
    <View className="border-b border-border bg-surface" style={{ paddingTop: insets.top }}>
      <View
        className="flex-row items-center justify-between gap-2"
        style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING, height: HEADER_CONTENT_HEIGHT }}>
        <View className="flex-shrink flex-row items-center gap-2">
          {leftElement}
          <Text className={TITLE_CLASSES[titleVariant]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View className="flex-row items-center justify-end">{right}</View>
      </View>
    </View>
  );
}
