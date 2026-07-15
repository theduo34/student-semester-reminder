import { Stack } from 'expo-router';

export default function ProtectedLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="activity/[entityId]/index" options={{ title: 'Details' }} />
      <Stack.Screen name="reminder-timing/[priority]/index" options={{ title: 'Reminder timing' }} />
    </Stack>
  );
}
