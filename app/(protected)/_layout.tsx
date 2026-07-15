import { Stack } from 'expo-router';

export default function ProtectedLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Both use AppTopBar instead of the native header — see components/shared/AppTopBar.tsx */}
      <Stack.Screen name="activity/[entityId]/index" options={{ headerShown: false }} />
      <Stack.Screen name="reminder-timing/[priority]/index" options={{ headerShown: false }} />
    </Stack>
  );
}
