import { Stack } from 'expo-router';

// Every pushed detail screen lives here on the (protected) Stack, never nested inside
// (tabs) — that's what hides the tab bar, gives a native back gesture, and keeps each
// screen a real Stack entry instead of a tabBarStyle:{display:'none'} hack (flaky
// across devices). This is the standard every future detail screen off Dashboard/
// Calendar/Alerts follows, not just Settings' reminder-timing rows.
export default function ProtectedLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Native header — platform-standard back button/gesture and title placement
          (centered on iOS, leading on Android, per each OS's own convention —
          native-stack has no cross-platform title-align override) come free this way.
          Every screen with a back button uses this, not AppTopBar — see CLAUDE.md's
          Back button styling note. `activity/[entityId]` sets its own dynamic
          `headerRight` (the three-dot menu, personal reminders only) via a local
          `<Stack.Screen options={...}>` inside the route component itself, since that
          depends on data the layout here doesn't have. */}
      <Stack.Screen
        name="activity/[entityId]/index"
        options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: 'Activity details' }}
      />
      <Stack.Screen
        name="settings/reminder-timing/[priority]/index"
        options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="settings/profile/index"
        options={{ headerShown: true, headerBackButtonDisplayMode: 'minimal', title: 'Profile' }}
      />
    </Stack>
  );
}
