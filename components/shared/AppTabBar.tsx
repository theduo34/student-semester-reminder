import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';

// Real tab slots (in state.routes order) after which the center action slot is
// inserted. Home(0), Calendar(1), [center action], Alerts(2), Settings(3) — five
// equal-width slots total when a center action is present, four when it isn't (see
// centerAction below) — either way this is the one splice point, student and admin
// tab bars alike.
const CENTER_ACTION_AFTER_INDEX = 2;

export type TabBarCenterAction = {
  icon: IconSymbolName;
  accessibilityLabel: string;
  onPress: () => void;
};

type AppTabBarProps = BottomTabBarProps & {
  /**
   * Omit entirely for the default (the student side's "Add reminder" FAB, pushing
   * `/add-activity`). Pass `null` to render no center action at all — the admin tab
   * bar's case: admin's creation actions live inside their own tabs (Hierarchy/
   * Courses/Publish), not behind a shared quick-create button, so there's nothing
   * generic to put here. Pass an explicit action object to use a different one.
   */
  centerAction?: TabBarCenterAction | null;
};

export function AppTabBar({ state, descriptors, navigation, centerAction }: AppTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [accent, accentForeground, muted] = useCSSVariable([
    '--accent',
    '--accent-foreground',
    '--muted',
  ]) as [string, string, string];

  const tabSlots = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const color = isFocused ? accent : muted;
    const icon = options.tabBarIcon?.({ focused: isFocused, color, size: 24 });
    const label = options.title ?? route.name;

    const onPress = () => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={isFocused ? { selected: true } : {}}
        className="flex-1 items-center justify-center gap-1 py-2">
        {icon}
        <Text style={{ color }} className="text-xs">
          {label}
        </Text>
      </Pressable>
    );
  });

  const resolvedCenterAction: TabBarCenterAction | null =
    centerAction === undefined
      ? { icon: 'plus', accessibilityLabel: 'Add reminder', onPress: () => router.push('/add-activity') }
      : centerAction;

  if (resolvedCenterAction) {
    tabSlots.splice(
      CENTER_ACTION_AFTER_INDEX,
      0,
      <View key="center-action-slot" className="flex-1 items-center justify-center">
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            resolvedCenterAction.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={resolvedCenterAction.accessibilityLabel}
          className="-mt-7.5 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg">
          <IconSymbol name={resolvedCenterAction.icon} color={accentForeground} size={28} />
        </Pressable>
      </View>,
    );
  }

  return (
    <View
      className="flex-row border-t border-border bg-surface"
      style={{ paddingBottom: insets.bottom }}>
      {tabSlots}
    </View>
  );
}
