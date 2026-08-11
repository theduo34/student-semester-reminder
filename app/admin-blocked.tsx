import { useAuthActions } from '@convex-dev/auth/react';
import { LinkButton, useThemeColor } from 'heroui-native';
import { Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Screen } from '@/components/ui/Screen';

const BADGE_SIZE = 132;

// Admin (role === 'admin') accounts are web-only — see termio-admin/AGENTS.md's
// Platform boundary section. This app has no admin route group anymore (that
// experience lives entirely in the termio-admin Next.js app, one Convex backend
// shared between both — see CONVEX_NOTES.md); an admin session reaching this app
// just needs pointing at the real place to work, not a broken/blank screen. Reached
// via hooks/use-auth-gate.ts's status: 'admin' branch, registered in app/_layout.tsx.
export default function AdminBlockedScreen() {
  const { signOut } = useAuthActions();
  const accentSoft = useThemeColor('accent-soft');
  const accent = useThemeColor('accent');

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: BADGE_SIZE,
            height: BADGE_SIZE,
            backgroundColor: accentSoft,
            shadowColor: accent,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.16,
            shadowRadius: 20,
            elevation: 6,
          }}>
          <IconSymbol name="desktopcomputer" size={56} color={accent} />
        </View>

        <View className="gap-3">
          <Text className="text-center text-xl font-bold text-foreground">
            Sign in from the web dashboard
          </Text>
          <Text className="text-center text-sm leading-5 text-muted">
            Admin accounts manage Termio from the web app, not this phone app. Head to the
            Termio Admin dashboard on a computer and sign in with the same email and password.
          </Text>
        </View>

        <LinkButton className="mt-2" onPress={() => signOut()}>
          <LinkButton.Label className="text-muted">Sign out</LinkButton.Label>
        </LinkButton>
      </View>
    </Screen>
  );
}
