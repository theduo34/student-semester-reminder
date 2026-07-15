import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { IconSymbol } from '@/components/ui/icon-symbol';

// Real tab slots (in state.routes order) after which the FAB slot is inserted.
// Home(0), Calendar(1), [FAB], Alerts(2), Settings(3) — five equal-width slots total.
const FAB_AFTER_INDEX = 2;

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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

  tabSlots.splice(
    FAB_AFTER_INDEX,
    0,
    <View key="fab-slot" className="flex-1 items-center justify-center">
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/add-activity');
        }}
        accessibilityRole="button"
        accessibilityLabel="Add activity"
        className="-mt-7.5 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg">
        <IconSymbol name="plus" color={accentForeground} size={28} />
      </Pressable>
    </View>,
  );

  return (
    <View
      className="flex-row border-t border-border bg-surface"
      style={{ paddingBottom: insets.bottom }}>
      {tabSlots}
    </View>
  );
}
