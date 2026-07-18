import { Redirect, Stack, usePathname } from 'expo-router';

import { useAuthGate } from '@/hooks/use-auth-gate';

export default function OnboardingLayout() {
  const gate = useAuthGate();
  const pathname = usePathname();

  if (gate.status === 'needsProfile' && pathname !== '/profile-setup') {
    return <Redirect href="/profile-setup" />;
  }
  if (gate.status === 'onboarding' && pathname === '/profile-setup') {
    return <Redirect href="/" />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
    </Stack>
  );
}
