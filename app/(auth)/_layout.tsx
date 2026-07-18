import { Redirect, Stack, usePathname } from 'expo-router';

import { useAuthGate } from '@/hooks/use-auth-gate';

export default function AuthLayout() {
  const gate = useAuthGate();
  const pathname = usePathname();

  if (gate.status === 'unverified' && pathname !== '/verify-email') {
    return <Redirect href={{ pathname: '/verify-email', params: { email: gate.email ?? '' } }} />;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Both use AppTopBar instead of the native header — see components/shared/AppTopBar.tsx */}
      <Stack.Screen name="verify-email" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
    </Stack>
  );
}
