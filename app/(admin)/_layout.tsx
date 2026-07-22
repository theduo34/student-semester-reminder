import { Stack } from 'expo-router';

// Mirrors app/(protected)/_layout.tsx's shape (a Stack wrapping (tabs), everything
// else pushed onto it) — no pushed detail screens yet this pass, just the tab group.
// Future admin detail screens (a hierarchy row's edit form, a course detail, etc.)
// register here as siblings of (tabs), same standing rule as the student side — see
// CLAUDE.md's Nested navigation section.
export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
