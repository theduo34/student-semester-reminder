import { Tabs } from 'expo-router';

import { AppTabBar } from '@/components/shared/AppTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Same shared AppTabBar the student side uses (same visual grammar — icon+label,
// active-state --accent coloring), just a different set of routes and no center
// action: admin's creation actions live inside their own tabs (Hierarchy/Courses/
// Publish), not behind a shared quick-create button the way the student FAB is — see
// CLAUDE.md's Admin route group section.
export default function AdminTabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} centerAction={null} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconSymbol name="square.grid.2x2.fill" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="hierarchy/index"
        options={{
          title: 'Hierarchy',
          tabBarIcon: ({ color }) => <IconSymbol name="building.2.fill" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="courses/index"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color }) => <IconSymbol name="books.vertical.fill" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="publish/index"
        options={{
          title: 'Publish',
          tabBarIcon: ({ color }) => <IconSymbol name="megaphone.fill" color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
