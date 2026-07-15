import { Tabs, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol name="house.fill" color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="calendar/index"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color }) => <IconSymbol name="calendar" color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="alerts/index"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color }) => <IconSymbol name="bell.fill" color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="settings/index"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <IconSymbol name="gearshape.fill" color={color} size={24} />,
          }}
        />
      </Tabs>

      {/* Persistent FAB, present on every tab. Not a Tabs.Screen — never carries active state. */}
      <Pressable
        onPress={() => router.push('/add-activity')}
        className="absolute bottom-8 left-1/2 h-14 w-14 -ml-7 items-center justify-center rounded-full bg-foreground">
        <IconSymbol name="plus" color="#fff" size={28} />
      </Pressable>
    </View>
  );
}
